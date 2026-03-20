import { useEffect, useMemo, useState } from 'react'
import './App.css'

const repoBase = 'https://github.com/AnshumanSakhare/gen-ai-experiments/tree/main'

const levels = [
  {
    key: 'level-0',
    code: 'Level 0',
    title: 'Prerequisites',
    summary: 'Set up tools and run your first GenAI notebook.',
    prerequisites: [
      'Python 3.10+ installed.',
      'Virtual environment created and activated.',
      'Basic Git and terminal usage.',
    ],
    checkpoints: [
      { text: 'Install required Python packages for notebook workflows.' },
      { text: 'Run one notebook from 100-os-libraries end-to-end.' },
      { text: 'Create a .env file and load one API key successfully.' },
      { text: 'Verify you can rerun the notebook without setup errors.' },
      {
        text: 'Practice project: apply setup on LangChain basics notebook.',
        projectName: 'LangChain Basics Notebook',
        projectPath: '100-os-libraries/LangChain_Basics_Building_Intelligent_Workflows.ipynb',
      },
    ],
    additionalProjects: [
      { name: 'Workshop JSON Prompting', path: 'workshop/json_prompting.ipynb' },
      {
        name: 'Prompt Engineering with Promptify',
        path: '100-os-libraries/Prompt_Engineering_with_Promptify.ipynb',
      },
    ],
  },
  {
    key: 'level-1',
    code: 'Level 1',
    title: 'LLM Basics',
    summary: 'Learn prompting, structure, and output controls.',
    prerequisites: [
      'Level 0 environment setup complete.',
      'Comfortable running notebooks locally.',
      'At least one working model API key.',
    ],
    checkpoints: [
      { text: 'Write 3 prompt variants for the same task.' },
      { text: 'Compare responses from 2 different models.' },
      { text: 'Use temperature and max token settings intentionally.' },
      { text: 'Generate consistent JSON output for one task.' },
      {
        text: 'Practice project: build a simple chat baseline app.',
        projectName: 'Chat with GPT OSS',
        projectPath: 'ai-apps-collection/chat-with-gpt-oss',
      },
    ],
    additionalProjects: [
      {
        name: 'Getting Started with Pydantic AI',
        path: '100-os-libraries/Getting_Started_with_Pydantic_AI.ipynb',
      },
      {
        name: 'Hugging Face Transformers',
        path: '100-os-libraries/Hugging_Face_Transformers_A_Powerful_Foundation_for_Generative_AI_and_NLP.ipynb',
      },
      {
        name: 'LiteLLM Simplified Integration',
        path: '100-os-libraries/LiteLLM_Simplified_LLM_Integration.ipynb',
      },
    ],
  },
  {
    key: 'level-2',
    code: 'Level 2',
    title: 'Simple GenAI Apps',
    summary: 'Build beginner-friendly apps with better reliability.',
    prerequisites: [
      'Prompt design basics from Level 1.',
      'Ability to run Streamlit or Python apps.',
      'Basic debugging for package and env issues.',
    ],
    checkpoints: [
      { text: 'Run one full app locally from start to finish.' },
      { text: 'Add one input validation rule to improve UX.' },
      { text: 'Add one prompt guardrail for bad user inputs.' },
      { text: 'Retest using 10 prompts and document failures.' },
      {
        text: 'Practice project: build and refine README generation flow.',
        projectName: 'GitHub Readme Generator',
        projectPath: 'ai-apps-collection/github-readme-file-generator',
      },
    ],
    additionalProjects: [
      { name: 'Educhain QnA Generator', path: 'ai-apps-collection/educhain-qna-generator' },
      { name: 'AI Ad Generator', path: 'ai-apps-collection/ai-ad-generator' },
      { name: 'Chat with PDF or Webpage', path: 'ai-apps-collection/chat-with-pdf-or-webpage' },
    ],
  },
  {
    key: 'level-3',
    code: 'Level 3',
    title: 'RAG + Agents',
    summary: 'Build retrieval pipelines and tool-using agents.',
    prerequisites: [
      'Level 2 app workflow confidence.',
      'Understanding of embeddings and vector search basics.',
      'Comfort with multi-step notebook workflows.',
    ],
    checkpoints: [
      { text: 'Create a retrieval pipeline with your own documents.' },
      { text: 'Tune chunk size and retrieval top-k settings.' },
      { text: 'Return sources/citations with generated answers.' },
      { text: 'Build one tool-calling agent with clear tool policy.' },
      {
        text: 'Practice project: implement full RAG query-answer loop.',
        projectName: 'RAG Interactive Notebook',
        projectPath: 'rag/RAG_Interactive.ipynb',
      },
    ],
    additionalProjects: [
      { name: 'LangGraph Supervisor', path: 'ai-agents/LangGraph_Supervisor.ipynb' },
      {
        name: 'CSV Agents with LangChain and LlamaIndex',
        path: 'ai-agents/CSV_Agents_with_LangChain_&_LlamaIndex.ipynb',
      },
      {
        name: 'How to Build Claude-Powered RAG',
        path: 'rag/How_to_build_Claude_powered_RAG_from_Scratch.ipynb',
      },
    ],
  },
  {
    key: 'level-4',
    code: 'Level 4',
    title: 'Production Systems',
    summary: 'Add evaluation, observability, and reliability.',
    prerequisites: [
      'One working RAG or agent project.',
      'Basic logging and metrics understanding.',
      'Ability to compare model outputs critically.',
    ],
    checkpoints: [
      { text: 'Create a reusable eval set with 20 realistic prompts.' },
      { text: 'Track latency, token usage, and failure counts.' },
      { text: 'Test edge cases: empty, noisy, and adversarial inputs.' },
      { text: 'Add fallback behavior for unusable model output.' },
      {
        text: 'Practice project: add tracing and reliability checks.',
        projectName: 'Agno Traceloop Observability',
        projectPath: 'ai-apps-collection/agno-traceloop-observability',
      },
    ],
    additionalProjects: [
      { name: 'LLM Testing Folder', path: 'llm-testing' },
      { name: 'AI Customer Support Workshop', path: 'workshop/AI_Customer_Support_Agent_.ipynb' },
      { name: 'MCP Workshop', path: 'workshop/MCP_Workshop.ipynb' },
    ],
  },
  {
    key: 'level-5',
    code: 'Level 5',
    title: 'Advanced GenAI',
    summary: 'Work with multimodal and MCP-enabled systems.',
    prerequisites: [
      'Stable Level 4 testing workflow.',
      'Understanding of cost-latency-quality tradeoffs.',
      'Experience with at least one production-like app.',
    ],
    checkpoints: [
      { text: 'Build one text+image or text+audio workflow.' },
      { text: 'Measure quality for at least 10 diverse examples.' },
      { text: 'Set up and run one MCP-based tool workflow.' },
      { text: 'Write a short before-after optimization report.' },
      {
        text: 'Practice project: ship one multimodal feature flow.',
        projectName: 'Gemini 2.0 Multimodal',
        projectPath: 'ai-apps-collection/gemini-2-0-multimodal',
      },
    ],
    additionalProjects: [
      { name: 'MCP Use Project', path: 'ai-apps-collection/mcp-use' },
      { name: 'Nano Banana Image Workflow NextJS', path: 'ai-apps-collection/nano-banana-image-workflow-nextjs' },
      { name: 'Cerebras Inference Comparison', path: 'ai-apps-collection/cerebras-inference-comparison' },
    ],
  },
  {
    key: 'level-6',
    code: 'Level 6',
    title: 'Specialization Paths',
    summary: 'Choose a path and deliver portfolio-ready capstones.',
    prerequisites: [
      'Levels 0-5 completed at least once.',
      'Clear interest area: app, engineering, research, or product.',
      'Ability to scope and ship independent projects.',
    ],
    checkpoints: [
      { text: 'Pick one specialization path document.' },
      { text: 'Define two capstone projects with measurable goals.' },
      { text: 'Build and evaluate both capstones fully.' },
      { text: 'Publish one write-up per capstone with metrics.' },
      {
        text: 'Practice project: follow AI Engineer path capstone plan.',
        projectName: 'AI Engineer Path',
        projectPath: 'docs/paths/ai-engineer.md',
      },
    ],
    additionalProjects: [
      { name: 'AI App Developer Path', path: 'docs/paths/ai-app-dev.md' },
      { name: 'ML Research Path', path: 'docs/paths/ml-research.md' },
      { name: 'AI Product Path', path: 'docs/paths/ai-product.md' },
    ],
  },
]

const specializationPaths = [
  {
    key: 'path-ai-app-dev',
    code: 'Path A',
    title: 'AI App Developer',
    summary: 'Focus on building and shipping user-facing GenAI apps quickly.',
    prerequisites: [
      'Level 2 app fundamentals done.',
      'Basic prompt and UX skills.',
      'Comfort deploying small apps.',
    ],
    checkpoints: [
      { text: 'Pick one user problem and define app MVP scope.' },
      { text: 'Build one production-style app with clear UX flow.' },
      { text: 'Add input validation, error handling, and retries.' },
      { text: 'Collect user feedback and ship one major improvement.' },
      {
        text: 'Practice project: build a chat + document app variant.',
        projectName: 'Chat with PDF or Webpage',
        projectPath: 'ai-apps-collection/chat-with-pdf-or-webpage',
      },
    ],
    additionalProjects: [
      { name: 'GitHub Readme Generator', path: 'ai-apps-collection/github-readme-file-generator' },
      { name: 'World Fastest Website Generator', path: 'ai-apps-collection/world-fastest-website-generator' },
      { name: 'AI Ad Generator', path: 'ai-apps-collection/ai-ad-generator' },
    ],
  },
  {
    key: 'path-ai-engineer',
    code: 'Path B',
    title: 'AI Engineer',
    summary: 'Focus on robust RAG, agents, evaluation, and system reliability.',
    prerequisites: [
      'Level 3 RAG and agent basics done.',
      'Comfort with logs, testing, and metrics.',
      'Understanding of architecture tradeoffs.',
    ],
    checkpoints: [
      { text: 'Build one RAG system with citations and eval set.' },
      { text: 'Add one tool-calling agent with fallback behavior.' },
      { text: 'Instrument tracing and latency metrics.' },
      { text: 'Benchmark 2 model/tool options and document choice.' },
      {
        text: 'Practice project: implement multi-agent orchestration flow.',
        projectName: 'LangGraph Supervisor',
        projectPath: 'ai-agents/LangGraph_Supervisor.ipynb',
      },
    ],
    additionalProjects: [
      { name: 'RAG Interactive Notebook', path: 'rag/RAG_Interactive.ipynb' },
      { name: 'Agno Traceloop Observability', path: 'ai-apps-collection/agno-traceloop-observability' },
      { name: 'LLM Testing Folder', path: 'llm-testing' },
    ],
  },
  {
    key: 'path-ml-research',
    code: 'Path C',
    title: 'ML Research',
    summary: 'Focus on experiments, model comparison, and reproducible findings.',
    prerequisites: [
      'Level 4 evaluation mindset.',
      'Notebook-based experiment workflow.',
      'Comfort reporting metrics clearly.',
    ],
    checkpoints: [
      { text: 'Define one benchmark objective and evaluation criteria.' },
      { text: 'Run controlled comparisons across 2-3 models.' },
      { text: 'Track quality, latency, and cost metrics consistently.' },
      { text: 'Publish one reproducible experiment report.' },
      {
        text: 'Practice project: run model benchmark notebooks.',
        projectName: 'LM Arena',
        projectPath: 'llm-testing/lm-arena',
      },
    ],
    additionalProjects: [
      { name: 'Promptfoo Testing', path: 'llm-testing/promptfoo' },
      { name: 'Cerebras Inference Comparison', path: 'ai-apps-collection/cerebras-inference-comparison' },
      { name: 'Fine Tuning Folder', path: 'fine-tuning' },
    ],
  },
  {
    key: 'path-ai-product',
    code: 'Path D',
    title: 'AI Product',
    summary: 'Focus on delivering AI features with measurable product impact.',
    prerequisites: [
      'Level 2 app implementation confidence.',
      'Basic product metrics understanding.',
      'Ability to map user problems to features.',
    ],
    checkpoints: [
      { text: 'Define one target user and high-impact AI use case.' },
      { text: 'Specify success metrics and acceptable failure bounds.' },
      { text: 'Build MVP and validate it with real user scenarios.' },
      { text: 'Plan rollout with monitoring and fallback rules.' },
      {
        text: 'Practice project: design and validate business assistant flow.',
        projectName: 'AI Business Consultant',
        projectPath: 'ai-apps-collection/ai-business-consultant',
      },
    ],
    additionalProjects: [
      { name: 'Stock Market Agent', path: 'ai-apps-collection/stock-market-agent' },
      { name: 'AI Customer Support Workshop', path: 'workshop/AI_Customer_Support_Agent_.ipynb' },
      { name: 'Travel Agent Workshop', path: 'workshop/Travel_Agent.ipynb' },
    ],
  },
]

const conceptsBySection = {
  'level-0': [
    'Python virtual environment',
    'pip install and requirements.txt',
    '.env and environment variables',
    'Jupyter notebook execution flow',
  ],
  'level-1': [
    'Prompt engineering and few-shot prompting',
    'Model comparison and hallucination checks',
    'temperature, top_p, max_tokens',
    'Structured output with JSON schema',
  ],
  'level-2': [
    'Local app bootstrapping and smoke testing',
    'Input validation and error handling',
    'Prompt guardrails and safety filtering',
    'Regression testing with prompt sets',
  ],
  'level-3': [
    'Embeddings and vector databases',
    'Document chunking and top-k retrieval',
    'Grounded generation and citations',
    'Tool/function calling agents',
  ],
  'level-4': [
    'Evaluation dataset design',
    'Observability metrics and tracing',
    'Robustness and adversarial testing',
    'Fallback and retry strategies',
  ],
  'level-5': [
    'Multimodal prompting',
    'MCP architecture and tool handshake',
    'Quality-cost-latency tradeoff',
    'Optimization and A/B comparison',
  ],
  'level-6': [
    'Specialization planning',
    'Capstone scoping and milestones',
    'Evaluation-driven project delivery',
    'Technical portfolio writing',
  ],
  'path-ai-app-dev': [
    'MVP scoping',
    'UX flow design for AI apps',
    'Validation and resilience patterns',
    'User feedback and iteration loops',
  ],
  'path-ai-engineer': [
    'RAG architecture',
    'Agent orchestration and fallback',
    'Tracing and performance telemetry',
    'Benchmark-driven model selection',
  ],
  'path-ml-research': [
    'Experiment design and hypotheses',
    'Controlled model comparison',
    'Metric tracking and reproducibility',
    'Research reporting best practices',
  ],
  'path-ai-product': [
    'User persona and use-case discovery',
    'Product success metrics and failure bounds',
    'MVP validation with scenarios',
    'Rollout planning and risk mitigation',
  ],
}

const referenceMaterialsBySection = {
  'level-0': [
    { type: 'Guide', name: 'Level 0 Roadmap Doc', path: 'docs/roadmap/level-0.md' },
  ],
  'level-1': [
    { type: 'Guide', name: 'Level 1 Roadmap Doc', path: 'docs/roadmap/level-1.md' },
  ],
  'level-2': [
    { type: 'Guide', name: 'Level 2 Roadmap Doc', path: 'docs/roadmap/level-2.md' },
  ],
  'level-3': [
    { type: 'Guide', name: 'Level 3 Roadmap Doc', path: 'docs/roadmap/level-3.md' },
  ],
  'level-4': [
    { type: 'Guide', name: 'Level 4 Roadmap Doc', path: 'docs/roadmap/level-4.md' },
  ],
  'level-5': [
    { type: 'Guide', name: 'Level 5 Roadmap Doc', path: 'docs/roadmap/level-5.md' },
  ],
  'level-6': [
    { type: 'Guide', name: 'Level 6 Roadmap Doc', path: 'docs/roadmap/level-6.md' },
  ],
  'path-ai-app-dev': [
    { type: 'Guide', name: 'AI App Developer Path Doc', path: 'docs/paths/ai-app-dev.md' },
  ],
  'path-ai-engineer': [
    { type: 'Guide', name: 'AI Engineer Path Doc', path: 'docs/paths/ai-engineer.md' },
  ],
  'path-ml-research': [
    { type: 'Guide', name: 'ML Research Path Doc', path: 'docs/paths/ml-research.md' },
  ],
  'path-ai-product': [
    { type: 'Guide', name: 'AI Product Path Doc', path: 'docs/paths/ai-product.md' },
  ],
}

const sections = [...levels, ...specializationPaths]

function App() {
  const [activeSection, setActiveSection] = useState('level-0')
  const [progress, setProgress] = useState({})

  useEffect(() => {
    const saved = localStorage.getItem('genai-roadmap-progress')
    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved)
      setProgress(parsed.progress ?? {})
      setActiveSection(parsed.activeSection ?? 'level-0')
    } catch {
      localStorage.removeItem('genai-roadmap-progress')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('genai-roadmap-progress', JSON.stringify({ progress, activeSection }))
  }, [progress, activeSection])

  const current = sections.find((item) => item.key === activeSection) ?? sections[0]
  const currentConcepts = conceptsBySection[current.key] ?? []
  const currentReferences = referenceMaterialsBySection[current.key] ?? []

  const totalCheckpoints = useMemo(
    () => sections.reduce((sum, section) => sum + section.checkpoints.length, 0),
    [],
  )

  const completedCheckpoints = useMemo(
    () => Object.values(progress).flat().filter(Boolean).length,
    [progress],
  )

  const completionPercent = Math.round((completedCheckpoints / totalCheckpoints) * 100)

  const toggleCheckpoint = (index) => {
    setProgress((prev) => {
      const existing = prev[current.key] ?? Array(current.checkpoints.length).fill(false)
      const updated = [...existing]
      updated[index] = !updated[index]
      return {
        ...prev,
        [current.key]: updated,
      }
    })
  }

  const resetProgress = () => {
    setProgress({})
    setActiveSection('level-0')
    localStorage.removeItem('genai-roadmap-progress')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>GenAI Roadmap</h1>
        <p className="subtitle">Access any level or specialization path directly.</p>

        <div className="progressBox">
          <p className="progressLabel">Checkpoint Progress</p>
          <div className="meter">
            <div className="meterFill" style={{ width: `${completionPercent}%` }} />
          </div>
          <p className="progressText">
            {completedCheckpoints}/{totalCheckpoints} complete ({completionPercent}%)
          </p>
        </div>

        <a className="docLink" href={`${repoBase}/docs/roadmap/ROADMAP.md`} target="_blank" rel="noreferrer">
          Open Curriculum Docs
        </a>

        <section className="levelNav">
          <h3>Levels</h3>
          <div className="levelList">
            {levels.map((level) => (
              <button
                key={level.key}
                type="button"
                className={`node ${level.key === activeSection ? 'active' : ''}`}
                onClick={() => setActiveSection(level.key)}
              >
                <span className="code">{level.code}</span>
                <strong>{level.title}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="levelNav">
          <h3>Specialization Paths</h3>
          <div className="levelList">
            {specializationPaths.map((path) => (
              <button
                key={path.key}
                type="button"
                className={`node ${path.key === activeSection ? 'active' : ''}`}
                onClick={() => setActiveSection(path.key)}
              >
                <span className="code">{path.code}</span>
                <strong>{path.title}</strong>
              </button>
            ))}
          </div>
        </section>

        <button className="ghost" type="button" onClick={resetProgress}>
          Reset Progress
        </button>
      </aside>

      <main className="content">
        <section className="details">
          <header className="detailsHeader">
            <h2>{current.code}: {current.title}</h2>
            <p>{current.summary}</p>
          </header>

          <article className="panel">
            <h3>Prerequisites</h3>
            <ul className="prereqList">
              {current.prerequisites.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h3>Concepts You Should Learn</h3>
            <ul className="conceptList">
              {currentConcepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h3>Checkpoint Tree</h3>
            <ul className="tree">
              {current.checkpoints.map((checkpoint, index) => (
                <li key={checkpoint.text}>
                  <label className="checkpointLine">
                    <input
                      type="checkbox"
                      checked={Boolean((progress[current.key] ?? [])[index])}
                      onChange={() => toggleCheckpoint(index)}
                    />
                    <span>{checkpoint.text}</span>
                  </label>
                  {checkpoint.projectPath && (
                    <a
                      className="practiceLink"
                      href={`${repoBase}/${checkpoint.projectPath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Practice now: {checkpoint.projectName}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h3>Reference Materials</h3>
            <ul className="extraProjects">
              {currentReferences.map((material) => (
                <li key={`${material.type}-${material.path}`}>
                  <a href={`${repoBase}/${material.path}`} target="_blank" rel="noreferrer">
                    {material.type}: {material.name}
                  </a>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <h3>Additional Projects You Can Make</h3>
            <ul className="extraProjects">
              {current.additionalProjects.map((project) => (
                <li key={project.path}>
                  <a href={`${repoBase}/${project.path}`} target="_blank" rel="noreferrer">
                    {project.name}
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </div>
  )
}

export default App


