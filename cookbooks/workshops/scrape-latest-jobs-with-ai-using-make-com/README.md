# Scrape Latest Jobs with AI using Make.com

This workshop demonstrates how to build an automated job scraping and resume customization system using Make.com (formerly Integromat). The workflow combines web scraping, AI-powered content generation, and automation to help job seekers find relevant positions and tailor their resumes accordingly.

## 🎯 What You'll Build

A two-part automation system that:

1. **Scrapes job listings** from Indeed using Apify
2. **Customizes resumes** using OpenAI GPT-4 to match specific job requirements

## 📋 Prerequisites

Before starting this workshop, you'll need:

- **Make.com account** (free tier available)
- **Apify account** for web scraping
- **OpenAI API key** for GPT-4 access
- Basic understanding of automation workflows
- A sample resume in text format

## 🛠️ Setup Instructions

### 1. Make.com Setup
1. Sign up for a [Make.com account](https://make.com)
2. Navigate to your dashboard
3. Create a new scenario

### 2. Apify Integration
1. Create an [Apify account](https://apify.com)
2. Get your Apify API token from your account settings
3. In Make.com, add Apify connection using your API token

### 3. OpenAI Integration
1. Get your OpenAI API key from [OpenAI Platform](https://platform.openai.com)
2. In Make.com, add OpenAI connection using your API key

## 🔄 Workflow Overview

### Part 1: Job Scraping (`1. Run Indeed Bulk Jobs Scraper.blueprint.json`)

This workflow:
- Uses Apify's Indeed scraper actor (`misceres/indeed-scraper`)
- Searches for jobs based on configurable parameters:
  - **Country**: IN (India) - customizable
  - **Position**: "web developer" - customizable
  - **Max Items**: 5 jobs per run
  - **Unique Items Only**: Prevents duplicates

**Key Configuration:**
```json
{
    "country": "IN",
    "followApplyRedirects": false,
    "maxItems": 5,
    "parseCompanyDetails": false,
    "position": "web developer",
    "saveOnlyUniqueItems": true
}
```

### Part 2: Resume Customization (`2. Get Results from Indeed Bulk Job Scraper & Customize Resume.blueprint.json`)

This workflow:
1. **Triggers** when the job scraping is complete (webhook-based)
2. **Fetches** scraped job data from Apify dataset
3. **Processes** each job through OpenAI GPT-4 to:
   - Analyze job requirements
   - Customize the resume to match the job
   - Maintain work history while adapting skills and descriptions
   - Output in Markdown format

**AI Prompt Strategy:**
- System role: "You're a helpful, intelligent writing assistant"
- User instruction: Customize resume to match job requirements while keeping work places the same
- Output format: Markdown (ATX format)
- Model: GPT-4o-latest for best results

## 📁 Files Included

- `1. Run Indeed Bulk Jobs Scraper.blueprint.json` - Job scraping workflow
- `2. Get Results from Indeed Bulk Job Scraper & Customize Resume.blueprint.json` - Resume customization workflow
- `README.md` - This documentation

## 🚀 How to Use

### Step 1: Import Blueprints
1. In Make.com, create a new scenario
2. Click "Import Blueprint"
3. Upload `1. Run Indeed Bulk Jobs Scraper.blueprint.json`
4. Configure your Apify connection
5. Repeat for the second blueprint

### Step 2: Configure Job Search Parameters
Edit the job scraper configuration:
- Change `position` to your target job title
- Adjust `country` if needed
- Modify `maxItems` based on your needs

### Step 3: Customize Resume Template
In the second workflow:
- Replace the sample resume with your actual resume
- Ensure your resume follows a clear format
- Test with a single job first

### Step 4: Run the Automation
1. Execute the job scraping workflow
2. The resume customization workflow will automatically trigger
3. Review the customized resumes generated for each job

## ⚙️ Customization Options

### Job Search Parameters
- **Position**: Any job title (e.g., "data scientist", "product manager")
- **Country**: Use country codes (US, UK, CA, AU, etc.)
- **Max Items**: Adjust based on your processing needs
- **Company Details**: Enable for more detailed company information

### Resume Customization
- **Temperature**: Adjust creativity (0.7 is balanced)
- **Max Tokens**: Control response length (4096 is generous)
- **Model**: Use different GPT models based on your needs

### Output Format
- Currently outputs Markdown
- Can be modified to output HTML, PDF, or plain text
- Easy to integrate with document generation tools

## 🔧 Troubleshooting

### Common Issues

**Apify Connection Failed**
- Verify your Apify API token
- Check if you have sufficient Apify credits
- Ensure the Indeed scraper actor is accessible

**OpenAI API Errors**
- Confirm your OpenAI API key is valid
- Check your OpenAI account has sufficient credits
- Verify GPT-4 access (may require paid plan)

**No Jobs Found**
- Try broader search terms
- Check if the country code is correct
- Verify Indeed has listings for your search criteria

**Resume Not Customizing Properly**
- Ensure your resume format is clear and structured
- Check the AI prompt for clarity
- Consider adjusting the temperature parameter

## 💡 Advanced Features

### Webhook Integration
The workflow uses webhooks for seamless automation between scraping and customization phases.

### Data Transformation
- Clean data processing from Apify
- JSON format handling
- Structured output generation

### Scalability
- Easily scale to process more jobs
- Add additional job boards
- Integrate with email or storage services

## 🎓 Learning Outcomes

After completing this workshop, you'll understand:
- Web scraping automation with Apify
- AI-powered content generation with OpenAI
- Workflow orchestration with Make.com
- Webhook-based automation triggers
- Data transformation and processing

## 📚 Additional Resources

- [Make.com Documentation](https://docs.make.com)
- [Apify Documentation](https://docs.apify.com)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Indeed Scraper Actor](https://apify.com/misceres/indeed-scraper)

## 🤝 Contributing

This workshop is part of the gen-ai-experiments repository. Feel free to:
- Submit improvements
- Report issues
- Share your customizations
- Add support for additional job boards

## 📄 License

This project is part of the gen-ai-experiments collection and follows the same licensing terms.

---

**Happy Job Hunting! 🎯**

*This automation can save hours of manual work by automatically finding relevant jobs and tailoring your resume for each application.*
