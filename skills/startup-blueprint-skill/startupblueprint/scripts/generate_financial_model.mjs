#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const NAVY = "#10243E";
const BLUE = "#2563EB";
const GREEN = "#008000";
const PALE_BLUE = "#EAF2FF";
const PALE_GREEN = "#E7F6EC";
const PALE_AMBER = "#FFF4CC";
const PALE_RED = "#FDE8E8";
const GREY = "#64748B";
const LIGHT = "#F5F7FA";
const BORDER = "#D8E0EA";

function usage() {
  console.log(`
StartupBlueprint financial-model generator

Usage:
  node generate_financial_model.mjs prepared.json output.xlsx [--preview-dir PATH]
`);
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h") || argv.length < 2) {
    usage();
    process.exit(argv.length < 2 ? 1 : 0);
  }
  const result = { input: argv[0], output: argv[1], previewDir: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--preview-dir") {
      result.previewDir = argv[index + 1];
      if (!result.previewDir) throw new Error("--preview-dir requires a path");
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argv[index]}`);
    }
  }
  return result;
}

function asText(value, fallback = "Unknown") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function sheetTitle(sheet, title, subtitle, endColumn = "H") {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${endColumn}1`).merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange(`A1:${endColumn}1`).format = {
    fill: NAVY,
    font: { color: "#FFFFFF", bold: true, size: 18 },
    rowHeight: 32,
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${endColumn}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endColumn}2`).format = {
    fill: "#E8EDF4",
    font: { color: "#334155", italic: true, size: 10 },
    rowHeight: 26,
    wrapText: true,
    verticalAlignment: "center",
  };
}

function section(sheet, row, title, endColumn = "H") {
  sheet.getRange(`A${row}:${endColumn}${row}`).merge();
  sheet.getRange(`A${row}`).values = [[title]];
  sheet.getRange(`A${row}:${endColumn}${row}`).format = {
    fill: NAVY,
    font: { color: "#FFFFFF", bold: true },
    rowHeight: 22,
  };
}

function tableHeader(sheet, range) {
  sheet.getRange(range).format = {
    fill: "#DDE6F2",
    font: { color: NAVY, bold: true },
    borders: { preset: "outside", style: "thin", color: BORDER },
    verticalAlignment: "center",
    wrapText: true,
  };
}

function statusFill(status) {
  if (status === "user" || status === "public") return PALE_GREEN;
  if (status === "assumption") return PALE_AMBER;
  return PALE_RED;
}

function setWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

function financialInputs() {
  return [
    ["opening_free_users", "Opening free users", "count"],
    ["opening_paid_customers", "Opening paid customers", "count"],
    ["monthly_new_free_users", "Monthly new free users", "count"],
    ["free_to_paid_conversion_rate", "Free-to-paid conversion", "rate"],
    ["monthly_new_paid_customers_direct", "Monthly direct paid customers", "count"],
    ["monthly_paid_churn_rate", "Monthly paid churn", "rate"],
    ["monthly_arpu_override", "Observed monthly ARPU override", "currency"],
    ["variable_cost_per_paid_customer", "Variable cost / paid customer", "currency"],
    ["variable_cost_per_free_user", "Variable cost / free user", "currency"],
    ["fixed_monthly_costs", "Fixed monthly costs", "currency"],
    ["monthly_acquisition_spend", "Monthly acquisition spend", "currency"],
    ["one_time_revenue_per_new_paid", "One-time revenue / new paid", "currency"],
    ["starting_cash", "Starting cash", "currency"],
  ];
}

function numberFormat(kind, currencyCode) {
  const symbol = { USD: "$", EUR: "€", GBP: "£" }[currencyCode] || `${currencyCode} `;
  if (kind === "rate") return "0.0%;[Red](0.0%);-";
  if (kind === "currency") return `"${symbol}"#,##0;[Red]("${symbol}"#,##0);-`;
  return "#,##0;[Red](#,##0);-";
}

function inputRowMap() {
  const result = {};
  financialInputs().forEach(([key], index) => {
    result[key] = 5 + index;
  });
  return result;
}

function forecastRows(start) {
  const names = [
    "header",
    "opening_free",
    "new_free",
    "converted",
    "ending_free",
    "opening_paid",
    "direct_paid",
    "new_paid",
    "churned",
    "ending_paid",
    "average_free",
    "average_paid",
    "arpu",
    "subscription_revenue",
    "one_time_revenue",
    "total_revenue",
    "paid_variable_cost",
    "free_variable_cost",
    "fixed_cost",
    "acquisition_spend",
    "total_cost",
    "operating_profit",
    "ending_cash",
  ];
  return Object.fromEntries(names.map((name, index) => [name, start + index + 1]));
}

function scenarioRow(index) {
  return 5 + index;
}

function addStatusRules(range) {
  range.conditionalFormats.add("containsText", {
    text: "OK",
    format: { fill: PALE_GREEN, font: { color: "#166534", bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "CHECK",
    format: { fill: PALE_RED, font: { color: "#991B1B", bold: true } },
  });
}

async function buildWorkbook(analysis) {
  const workbook = Workbook.create();
  workbook.comments.setSelf({ displayName: "Build Fast with AI" });

  const dashboard = workbook.worksheets.add("Dashboard");
  const inputs = workbook.worksheets.add("Inputs");
  const pricing = workbook.worksheets.add("Pricing");
  const scenarios = workbook.worksheets.add("Scenarios");
  const forecast = workbook.worksheets.add("12-Month Forecast");
  const unit = workbook.worksheets.add("Unit Economics");
  const sources = workbook.worksheets.add("Sources & Assumptions");
  const checks = workbook.worksheets.add("Checks");

  const currency = analysis.product?.currency || analysis.pricing?.currency || "USD";
  const currencyFormat = numberFormat("currency", currency);
  const inputMap = inputRowMap();

  // Inputs
  sheetTitle(inputs, "Operating Inputs", "Blue cells are editable. Yellow or red cells need validation.", "F");
  inputs.getRange("A4:F4").values = [["Driver", "Value", "Status", "Confidence", "Basis", "Source URL"]];
  tableHeader(inputs, "A4:F4");
  const inputData = financialInputs().map(([key, label]) => {
    const item = analysis.financial_inputs[key];
    return [label, item.value, item.status, item.confidence, item.basis, item.source_url || ""];
  });
  inputs.getRange(`A5:F${4 + inputData.length}`).values = inputData;
  inputs.getRange(`A5:F${4 + inputData.length}`).format.borders = {
    preset: "inside",
    style: "thin",
    color: BORDER,
  };
  financialInputs().forEach(([key, , kind], index) => {
    const row = 5 + index;
    const item = analysis.financial_inputs[key];
    inputs.getRange(`B${row}`).format = {
      font: { color: BLUE },
      fill: statusFill(item.status),
      numberFormat: numberFormat(kind, currency),
    };
    inputs.getRange(`C${row}`).format.fill = statusFill(item.status);
    workbook.comments.addThread(
      { cell: inputs.getRange(`B${row}`) },
      `${item.status.toUpperCase()} · ${item.basis}${item.source_url ? ` · ${item.source_url}` : ""}`,
    );
  });
  setWidths(inputs, { A: 30, B: 16, C: 14, D: 13, E: 54, F: 42 });
  inputs.getRange(`D5:F${4 + inputData.length}`).format.wrapText = true;
  inputs.freezePanes.freezeRows(4);

  // Pricing
  sheetTitle(pricing, "Pricing Architecture", "Edit price and paid mix to update every scenario.", "H");
  pricing.getRange("A4:H4").values = [[
    "Tier",
    "Type",
    "Target segment",
    "Monthly price",
    "Paid mix",
    "Annual monthly equivalent",
    "Limits",
    "Upgrade trigger",
  ]];
  tableHeader(pricing, "A4:H4");
  const tiers = analysis.pricing.tiers;
  const tierRows = tiers.map((tier) => [
    tier.name,
    tier.tier_type,
    tier.target_segment,
    tier.monthly_price,
    tier.expected_paid_mix,
    tier.annual_monthly_equivalent,
    tier.limits,
    tier.upgrade_trigger,
  ]);
  const tierEnd = 4 + tierRows.length;
  pricing.getRange(`A5:H${tierEnd}`).values = tierRows;
  pricing.getRange(`D5:F${tierEnd}`).format.font = { color: BLUE };
  pricing.getRange(`D5:D${tierEnd}`).format.numberFormat = currencyFormat;
  pricing.getRange(`E5:E${tierEnd}`).format.numberFormat = "0.0%";
  pricing.getRange(`F5:F${tierEnd}`).format.numberFormat = currencyFormat;
  pricing.getRange(`C5:C${tierEnd}`).format.wrapText = true;
  pricing.getRange(`G5:H${tierEnd}`).format.wrapText = true;
  section(pricing, 18, "Calculated Pricing Outputs", "H");
  pricing.getRange("A19:B20").values = [["Metric", "Result"], ["Weighted monthly ARPU", null]];
  tableHeader(pricing, "A19:B19");
  pricing.getRange("B20").formulas = [[`=SUMPRODUCT(D5:D${tierEnd},E5:E${tierEnd})`]];
  pricing.getRange("B20").format = { font: { color: "#000000", bold: true }, numberFormat: currencyFormat };
  pricing.getRange("D19:H20").values = [[
    "Model",
    "Free decision",
    "Trial",
    "Annual discount",
    "Lifetime",
  ], [
    analysis.pricing.recommended_model,
    analysis.pricing.free_plan_decision,
    analysis.pricing.trial,
    analysis.pricing.annual_discount_percent / 100,
    analysis.pricing.lifetime_verdict,
  ]];
  tableHeader(pricing, "D19:H19");
  pricing.getRange("G20").format.numberFormat = "0%";
  setWidths(pricing, { A: 18, B: 12, C: 28, D: 34, E: 30, F: 20, G: 20, H: 26 });
  pricing.freezePanes.freezeRows(4);

  // Scenarios
  sheetTitle(scenarios, "Scenario Drivers", "Base must remain 1.0. Conservative and optimistic are editable multipliers.", "I");
  scenarios.getRange("A4:I4").values = [[
    "Scenario",
    "New free",
    "Conversion",
    "Direct paid",
    "Churn",
    "ARPU",
    "Variable cost",
    "Fixed cost",
    "Acquisition spend",
  ]];
  tableHeader(scenarios, "A4:I4");
  const scenarioData = analysis.scenarios.map((item) => [
    item.name,
    item.new_free_users_multiplier,
    item.conversion_multiplier,
    item.new_paid_multiplier,
    item.churn_multiplier,
    item.arpu_multiplier,
    item.variable_cost_multiplier,
    item.fixed_cost_multiplier,
    item.acquisition_spend_multiplier,
  ]);
  scenarios.getRange("A5:I7").values = scenarioData;
  scenarios.getRange("B5:I7").format = { font: { color: BLUE }, numberFormat: "0.00x" };
  scenarios.getRange("A5:I7").format.borders = { preset: "inside", style: "thin", color: BORDER };
  setWidths(scenarios, { A: 18, B: 14, C: 14, D: 14, E: 14, F: 14, G: 15, H: 14, I: 18 });
  scenarios.freezePanes.freezeRows(4);

  // Forecast
  sheetTitle(forecast, "12-Month Forecast", "Formula-driven customer, revenue, cost, profit, and cash model.", "N");
  setWidths(forecast, { A: 3, B: 30, C: 14, D: 14, E: 14, F: 14, G: 14, H: 14, I: 14, J: 14, K: 14, L: 14, M: 14, N: 14 });
  const scenarioBlocks = [];
  const monthColumns = "CDEFGHIJKLMN".split("");
  analysis.scenarios.forEach((scenario, index) => {
    const start = 5 + index * 26;
    const rows = forecastRows(start);
    const scenarioSourceRow = scenarioRow(index);
    scenarioBlocks.push({ name: scenario.name, rows });
    section(forecast, start, `${scenario.name.toUpperCase()} SCENARIO`, "N");
    forecast.getRange(`B${rows.header}:N${rows.header}`).values = [[
      "Metric",
      ...Array.from({ length: 12 }, (_, month) => `M${month + 1}`),
    ]];
    tableHeader(forecast, `B${rows.header}:N${rows.header}`);
    const labels = [
      [rows.opening_free, "Opening free users"],
      [rows.new_free, "New free users"],
      [rows.converted, "Free users converted"],
      [rows.ending_free, "Ending free users"],
      [rows.opening_paid, "Opening paid customers"],
      [rows.direct_paid, "Direct new paid"],
      [rows.new_paid, "Total new paid"],
      [rows.churned, "Paid customers churned"],
      [rows.ending_paid, "Ending paid customers"],
      [rows.average_free, "Average free users"],
      [rows.average_paid, "Average paid customers"],
      [rows.arpu, "Effective monthly ARPU"],
      [rows.subscription_revenue, "Subscription revenue"],
      [rows.one_time_revenue, "One-time revenue"],
      [rows.total_revenue, "Total revenue"],
      [rows.paid_variable_cost, "Paid variable cost"],
      [rows.free_variable_cost, "Free variable cost"],
      [rows.fixed_cost, "Fixed cost"],
      [rows.acquisition_spend, "Acquisition spend"],
      [rows.total_cost, "Total cost"],
      [rows.operating_profit, "Operating profit"],
      [rows.ending_cash, "Ending cash"],
    ];
    for (const [row, label] of labels) forecast.getRange(`B${row}`).values = [[label]];

    monthColumns.forEach((column, monthIndex) => {
      const previous = monthColumns[monthIndex - 1];
      const f = (row) => `${column}${row}`;
      forecast.getRange(f(rows.opening_free)).formulas = [[
        monthIndex === 0 ? `='Inputs'!$B$${inputMap.opening_free_users}` : `=${previous}${rows.ending_free}`,
      ]];
      forecast.getRange(f(rows.new_free)).formulas = [[
        `='Inputs'!$B$${inputMap.monthly_new_free_users}*'Scenarios'!$B$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.converted)).formulas = [[
        `=${f(rows.opening_free)}*'Inputs'!$B$${inputMap.free_to_paid_conversion_rate}*'Scenarios'!$C$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.ending_free)).formulas = [[
        `=MAX(0,${f(rows.opening_free)}+${f(rows.new_free)}-${f(rows.converted)})`,
      ]];
      forecast.getRange(f(rows.opening_paid)).formulas = [[
        monthIndex === 0 ? `='Inputs'!$B$${inputMap.opening_paid_customers}` : `=${previous}${rows.ending_paid}`,
      ]];
      forecast.getRange(f(rows.direct_paid)).formulas = [[
        `='Inputs'!$B$${inputMap.monthly_new_paid_customers_direct}*'Scenarios'!$D$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.new_paid)).formulas = [[`=${f(rows.converted)}+${f(rows.direct_paid)}`]];
      forecast.getRange(f(rows.churned)).formulas = [[
        `=${f(rows.opening_paid)}*'Inputs'!$B$${inputMap.monthly_paid_churn_rate}*'Scenarios'!$E$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.ending_paid)).formulas = [[
        `=MAX(0,${f(rows.opening_paid)}+${f(rows.new_paid)}-${f(rows.churned)})`,
      ]];
      forecast.getRange(f(rows.average_free)).formulas = [[
        `=(${f(rows.opening_free)}+${f(rows.ending_free)})/2`,
      ]];
      forecast.getRange(f(rows.average_paid)).formulas = [[
        `=(${f(rows.opening_paid)}+${f(rows.ending_paid)})/2`,
      ]];
      forecast.getRange(f(rows.arpu)).formulas = [[
        `=IF('Inputs'!$B$${inputMap.monthly_arpu_override}>0,'Inputs'!$B$${inputMap.monthly_arpu_override},'Pricing'!$B$20)*'Scenarios'!$F$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.subscription_revenue)).formulas = [[
        `=${f(rows.average_paid)}*${f(rows.arpu)}`,
      ]];
      forecast.getRange(f(rows.one_time_revenue)).formulas = [[
        `=${f(rows.new_paid)}*'Inputs'!$B$${inputMap.one_time_revenue_per_new_paid}`,
      ]];
      forecast.getRange(f(rows.total_revenue)).formulas = [[
        `=${f(rows.subscription_revenue)}+${f(rows.one_time_revenue)}`,
      ]];
      forecast.getRange(f(rows.paid_variable_cost)).formulas = [[
        `=${f(rows.average_paid)}*'Inputs'!$B$${inputMap.variable_cost_per_paid_customer}*'Scenarios'!$G$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.free_variable_cost)).formulas = [[
        `=${f(rows.average_free)}*'Inputs'!$B$${inputMap.variable_cost_per_free_user}*'Scenarios'!$G$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.fixed_cost)).formulas = [[
        `='Inputs'!$B$${inputMap.fixed_monthly_costs}*'Scenarios'!$H$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.acquisition_spend)).formulas = [[
        `='Inputs'!$B$${inputMap.monthly_acquisition_spend}*'Scenarios'!$I$${scenarioSourceRow}`,
      ]];
      forecast.getRange(f(rows.total_cost)).formulas = [[
        `=SUM(${f(rows.paid_variable_cost)}:${f(rows.acquisition_spend)})`,
      ]];
      forecast.getRange(f(rows.operating_profit)).formulas = [[
        `=${f(rows.total_revenue)}-${f(rows.total_cost)}`,
      ]];
      forecast.getRange(f(rows.ending_cash)).formulas = [[
        monthIndex === 0
          ? `='Inputs'!$B$${inputMap.starting_cash}+${f(rows.operating_profit)}`
          : `=${previous}${rows.ending_cash}+${f(rows.operating_profit)}`,
      ]];
    });
    forecast.getRange(`C${rows.opening_free}:N${rows.average_paid}`).format.numberFormat = "#,##0.0";
    forecast.getRange(`C${rows.arpu}:N${rows.ending_cash}`).format.numberFormat = currencyFormat;
    forecast.getRange(`C${rows.opening_free}:N${rows.ending_cash}`).format.font = { color: GREEN };
    forecast.getRange(`B${rows.total_revenue}:N${rows.total_revenue}`).format = {
      fill: PALE_BLUE,
      font: { bold: true, color: GREEN },
      borders: { preset: "doubleBottom", style: "thin", color: NAVY },
    };
    forecast.getRange(`B${rows.operating_profit}:N${rows.operating_profit}`).format = {
      fill: PALE_GREEN,
      font: { bold: true, color: GREEN },
      borders: { preset: "doubleBottom", style: "thin", color: NAVY },
    };
  });
  forecast.freezePanes.freezeRows(5);
  forecast.freezePanes.freezeColumns(2);

  // Unit economics
  sheetTitle(unit, "Unit Economics", "Formula-driven economics for conservative, base, and optimistic scenarios.", "H");
  unit.getRange("A4:H4").values = [[
    "Scenario",
    "ARPU",
    "Contribution / paid",
    "Contribution margin",
    "Blended CAC",
    "CAC payback",
    "Simplified LTV",
    "Break-even paid",
  ]];
  tableHeader(unit, "A4:H4");
  analysis.scenarios.forEach((scenario, index) => {
    const row = 5 + index;
    const srow = scenarioRow(index);
    const block = scenarioBlocks[index].rows;
    unit.getRange(`A${row}`).values = [[scenario.name]];
    unit.getRange(`B${row}`).formulas = [[`='12-Month Forecast'!$C$${block.arpu}`]];
    unit.getRange(`C${row}`).formulas = [[
      `=B${row}-'Inputs'!$B$${inputMap.variable_cost_per_paid_customer}*'Scenarios'!$G$${srow}`,
    ]];
    unit.getRange(`D${row}`).formulas = [[`=IF(B${row}>0,C${row}/B${row},0)`]];
    unit.getRange(`E${row}`).formulas = [[
      `=IF('12-Month Forecast'!$C$${block.new_paid}>0,'Inputs'!$B$${inputMap.monthly_acquisition_spend}*'Scenarios'!$I$${srow}/'12-Month Forecast'!$C$${block.new_paid},0)`,
    ]];
    unit.getRange(`F${row}`).formulas = [[`=IF(C${row}>0,E${row}/C${row},0)`]];
    unit.getRange(`G${row}`).formulas = [[
      `=IF('Inputs'!$B$${inputMap.monthly_paid_churn_rate}*'Scenarios'!$E$${srow}>0,C${row}/('Inputs'!$B$${inputMap.monthly_paid_churn_rate}*'Scenarios'!$E$${srow}),0)`,
    ]];
    unit.getRange(`H${row}`).formulas = [[
      `=IF(C${row}>0,'Inputs'!$B$${inputMap.fixed_monthly_costs}*'Scenarios'!$H$${srow}/C${row},0)`,
    ]];
  });
  unit.getRange("B5:C7").format.numberFormat = currencyFormat;
  unit.getRange("D5:D7").format.numberFormat = "0.0%";
  unit.getRange("E5:E7").format.numberFormat = currencyFormat;
  unit.getRange("F5:F7").format.numberFormat = "0.0x";
  unit.getRange("G5:G7").format.numberFormat = currencyFormat;
  unit.getRange("H5:H7").format.numberFormat = "#,##0.0";
  unit.getRange("B5:H7").format.font = { color: GREEN };
  setWidths(unit, { A: 18, B: 16, C: 22, D: 21, E: 16, F: 16, G: 18, H: 18 });

  // Dashboard
  sheetTitle(dashboard, "StartupBlueprint", `${analysis.product.name} · ${analysis.generated_at} · ${analysis.mode} mode`, "J");
  section(dashboard, 4, "Decision Snapshot", "J");
  dashboard.getRange("A5:B12").values = [
    ["Startup", analysis.product.name],
    ["Recommended model", analysis.business_model.recommended_model],
    ["Pricing model", analysis.pricing.recommended_model],
    ["First channel", analysis.strategy.go_to_market.primary_channel],
    ["Readiness score", analysis.readiness_score / 100],
    ["Plan status", analysis.analysis_status],
    ["Financial verdict", analysis.financial_verdict],
    ["Largest warning", analysis.quality_warnings?.[0] || "No critical warning"],
  ];
  dashboard.getRange("A5:A12").format = { fill: LIGHT, font: { bold: true, color: NAVY } };
  dashboard.getRange("B5:B12").format.wrapText = true;
  dashboard.getRange("B9").format.numberFormat = "0%";
  section(dashboard, 14, "Base Economics", "J");
  dashboard.getRange("A15:B20").values = [
    ["Metric", "Result"],
    ["Weighted ARPU", null],
    ["Contribution / paid", null],
    ["Contribution margin", null],
    ["CAC payback", null],
    ["Break-even paid customers", null],
  ];
  tableHeader(dashboard, "A15:B15");
  dashboard.getRange("B16:B20").formulas = [
    ["='Pricing'!$B$20"],
    ["='Unit Economics'!$C$6"],
    ["='Unit Economics'!$D$6"],
    ["='Unit Economics'!$F$6"],
    ["='Unit Economics'!$H$6"],
  ];
  dashboard.getRange("B16:B17").format.numberFormat = currencyFormat;
  dashboard.getRange("B18").format.numberFormat = "0.0%";
  dashboard.getRange("B19").format.numberFormat = "0.0x";
  dashboard.getRange("B20").format.numberFormat = "#,##0.0";
  dashboard.getRange("B16:B20").format.font = { color: GREEN, bold: true };
  const base = scenarioBlocks.find((item) => item.name === "base") || scenarioBlocks[1];
  dashboard.getRange("D15:I19").values = [
    ["Scenario", "12M revenue", "12M profit", "M12 profit", "Ending paid", "Ending cash"],
    ...scenarioBlocks.map((block) => [block.name, null, null, null, null, null]),
    ["Note", "All scenarios recalculate from Inputs, Pricing, and Scenarios.", null, null, null, null],
  ];
  tableHeader(dashboard, "D15:I15");
  scenarioBlocks.forEach((block, index) => {
    const row = 16 + index;
    dashboard.getRange(`E${row}:I${row}`).formulas = [[
      `=SUM('12-Month Forecast'!$C$${block.rows.total_revenue}:$N$${block.rows.total_revenue})`,
      `=SUM('12-Month Forecast'!$C$${block.rows.operating_profit}:$N$${block.rows.operating_profit})`,
      `='12-Month Forecast'!$N$${block.rows.operating_profit}`,
      `='12-Month Forecast'!$N$${block.rows.ending_paid}`,
      `='12-Month Forecast'!$N$${block.rows.ending_cash}`,
    ]];
  });
  dashboard.getRange("E16:G18").format.numberFormat = currencyFormat;
  dashboard.getRange("H16:H18").format.numberFormat = "#,##0.0";
  dashboard.getRange("I16:I18").format.numberFormat = currencyFormat;
  dashboard.getRange("E16:I18").format.font = { color: GREEN };
  dashboard.getRange("D19:I19").merge();
  dashboard.getRange("D19").values = [["All scenarios recalculate from Inputs, Pricing, and Scenarios."]];
  dashboard.getRange("D19:I19").format = { fill: PALE_AMBER, font: { italic: true, color: "#92400E" } };

  dashboard.getRange("B24:E36").values = [
    ["Month", "Revenue", "Total cost", "Operating profit"],
    ...Array.from({ length: 12 }, (_, month) => [`M${month + 1}`, null, null, null]),
  ];
  dashboard.getRange("B25:E36").formulas = Array.from({ length: 12 }, (_, month) => {
    const column = monthColumns[month];
    return [
      "",
      `='12-Month Forecast'!$${column}$${base.rows.total_revenue}`,
      `='12-Month Forecast'!$${column}$${base.rows.total_cost}`,
      `='12-Month Forecast'!$${column}$${base.rows.operating_profit}`,
    ];
  });
  dashboard.getRange("B25:B36").values = Array.from({ length: 12 }, (_, month) => [`M${month + 1}`]);
  tableHeader(dashboard, "B24:E24");
  dashboard.getRange("C25:E36").format.numberFormat = currencyFormat;
  const chart = dashboard.charts.add("line", dashboard.getRange("B24:E36"));
  chart.title = "Base Revenue, Cost, and Profit";
  chart.titleTextStyle.fontSize = 12;
  chart.hasLegend = true;
  chart.xAxis = { axisType: "textAxis" };
  chart.yAxis = { numberFormatCode: currencyFormat };
  chart.setPosition("G22", "N38");
  setWidths(dashboard, { A: 26, B: 34, C: 16, D: 18, E: 18, F: 18, G: 18, H: 18, I: 18, J: 4 });
  dashboard.freezePanes.freezeRows(4);

  // Sources and assumptions
  sheetTitle(sources, "Sources & Assumptions", "Audit trail for public evidence, assumptions, and limitations.", "F");
  sources.getRange("A4:F4").values = [["Title", "Kind", "Checked", "URL", "Note", "Role"]];
  tableHeader(sources, "A4:F4");
  const sourceRows = analysis.sources.map((item) => [
    item.title,
    item.kind,
    item.checked_at,
    item.url,
    item.note,
    "Public evidence",
  ]);
  if (sourceRows.length) sources.getRange(`A5:F${4 + sourceRows.length}`).values = sourceRows;
  const limitationStart = 6 + sourceRows.length;
  section(sources, limitationStart, "Limitations", "F");
  const limitationRows = analysis.limitations.map((item) => [item]);
  if (limitationRows.length) {
    sources.getRange(`A${limitationStart + 1}:F${limitationStart + limitationRows.length}`).merge(true);
    sources.getRange(`A${limitationStart + 1}:A${limitationStart + limitationRows.length}`).values = limitationRows;
  }
  setWidths(sources, { A: 27, B: 13, C: 13, D: 48, E: 54, F: 18 });
  sources.getRange(`A1:F${limitationStart + limitationRows.length}`).format.wrapText = true;
  sources.freezePanes.freezeRows(4);

  // Checks
  sheetTitle(checks, "Model Checks", "Every check should show OK before the model is treated as decision-ready.", "F");
  checks.getRange("A4:F4").values = [["Check", "Actual", "Expected", "Difference", "Status", "Fix hint"]];
  tableHeader(checks, "A4:F4");
  checks.getRange("A5:F9").values = [
    ["Paid tier mix", null, 1, null, null, "Set paid-tier mix to 100%."],
    ["Base scenario multiplier total", null, 8, null, null, "Keep every base multiplier at 1.0."],
    ["Critical input completeness", null, 4, null, null, "Populate churn, paid variable cost, fixed cost, and acquisition spend."],
    ["Weighted ARPU positive", null, 1, null, null, "Set at least one positive paid tier price."],
    ["Forecast output numeric", null, 1, null, null, "Inspect formulas on 12-Month Forecast."],
  ];
  checks.getRange("B5:B9").formulas = [
    [`=SUM('Pricing'!$E$5:$E$${tierEnd})`],
    ["=SUM('Scenarios'!$B$6:$I$6)"],
    [`=COUNT('Inputs'!$B$${inputMap.monthly_paid_churn_rate},'Inputs'!$B$${inputMap.variable_cost_per_paid_customer},'Inputs'!$B$${inputMap.fixed_monthly_costs},'Inputs'!$B$${inputMap.monthly_acquisition_spend})`],
    ["=IF('Pricing'!$B$20>0,1,0)"],
    [`=IF(ISNUMBER('12-Month Forecast'!$N$${base.rows.operating_profit}),1,0)`],
  ];
  checks.getRange("D5:D9").formulas = [
    ["=B5-C5"],
    ["=B6-C6"],
    ["=B7-C7"],
    ["=B8-C8"],
    ["=B9-C9"],
  ];
  checks.getRange("E5:E9").formulas = [
    ['=IF(ABS(D5)<0.01,"OK","CHECK")'],
    ['=IF(ABS(D6)<0.01,"OK","CHECK")'],
    ['=IF(ABS(D7)<0.01,"OK","CHECK")'],
    ['=IF(ABS(D8)<0.01,"OK","CHECK")'],
    ['=IF(ABS(D9)<0.01,"OK","CHECK")'],
  ];
  checks.getRange("A11:B11").values = [["Overall model status", null]];
  checks.getRange("B11").formulas = [['=IF(COUNTIF(E5:E9,"CHECK")=0,"OK","CHECK")']];
  checks.getRange("A11:B11").format = { fill: LIGHT, font: { bold: true } };
  addStatusRules(checks.getRange("E5:E9"));
  addStatusRules(checks.getRange("B11"));
  setWidths(checks, { A: 31, B: 16, C: 16, D: 16, E: 14, F: 54 });
  checks.getRange("F5:F9").format.wrapText = true;

  return { workbook, sheetNames: [
    "Dashboard",
    "Inputs",
    "Pricing",
    "Scenarios",
    "12-Month Forecast",
    "Unit Economics",
    "Sources & Assumptions",
    "Checks",
  ] };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const analysis = JSON.parse(await fs.readFile(args.input, "utf8"));
  const { workbook, sheetNames } = await buildWorkbook(analysis);

  const dashboardCheck = await workbook.inspect({
    kind: "table",
    range: "Dashboard!A1:J20",
    include: "values,formulas",
    tableMaxRows: 20,
    tableMaxCols: 10,
    maxChars: 5000,
  });
  console.log(dashboardCheck.ndjson);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "final formula error scan",
    maxChars: 5000,
  });
  console.log(errors.ndjson);

  if (args.previewDir) {
    await fs.mkdir(args.previewDir, { recursive: true });
    for (const sheetName of sheetNames) {
      const preview = await workbook.render({
        sheetName,
        autoCrop: "all",
        scale: 1,
        format: "png",
      });
      const fileName = `${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      await fs.writeFile(path.join(args.previewDir, fileName), new Uint8Array(await preview.arrayBuffer()));
    }
  }

  await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(args.output);
  console.log(`Generated financial model: ${args.output}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
