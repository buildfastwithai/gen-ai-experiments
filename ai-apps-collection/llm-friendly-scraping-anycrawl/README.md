# AnyCrawl Web Scraper Streamlit App

A Streamlit application that uses the AnyCrawl API to scrape webpages and convert them into structured data optimized for Large Language Models (LLM).

## Features

- Clean, user-friendly interface
- Sidebar for API key configuration
- Multiple scraping engines (cheerio, playwright, puppeteer)
- Support for multiple output formats (Markdown, HTML, JSON, screenshots)
- Download scraped content in various formats
- Responsive design that works on desktop and mobile

## Prerequisites

1. Python 3.7 or higher
2. An AnyCrawl API key (get one at [anycrawl.dev](https://anycrawl.dev))

## Installation

1. Clone this repository or download the files
2. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Run the Streamlit app:
   ```bash
   streamlit run app.py
   ```
2. Enter your AnyCrawl API key in the sidebar
3. Paste the URL you want to scrape
4. Configure scraping options as needed
5. Click "Scrape Webpage"
6. View and download the results

## How It Works

The app uses the AnyCrawl API to:
1. Scrape webpages using various engines
2. Extract clean content optimized for LLMs
3. Provide multiple output formats
4. Handle dynamic content with Playwright/Puppeteer

## Supported Formats

- **Markdown**: Clean, structured text content
- **HTML**: Raw HTML of the page
- **JSON**: Structured data extraction
- **Screenshots**: Full-page screenshots
- **Links**: Extracted hyperlinks from the page