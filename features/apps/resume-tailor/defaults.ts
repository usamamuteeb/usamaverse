/** Starter content so the app works before you paste your own resume. Replace it in Setup. */

export const DEFAULT_TEX = String.raw`\documentclass[letterpaper,11pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{tabularx}
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\titleformat{\section}{\vspace{-4pt}\scshape\raggedright\large}{}{0em}{}[\titlerule \vspace{-5pt}]

\newcommand{\resumeItem}[1]{\item\small{{#1 \vspace{-2pt}}}}
\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

\begin{document}

\begin{center}
  \textbf{\Huge \scshape Your Name} \\ \vspace{1pt}
  \small Data Analyst $|$ +92 300 0000000 $|$ \href{mailto:you@example.com}{\underline{you@example.com}} $|$
  \href{https://linkedin.com/in/you}{\underline{linkedin.com/in/you}}
\end{center}

\section{Summary}
{\small Data analyst with 4+ years of experience turning raw data into clear reports and dashboards for business teams.}

\section{Experience}
  \resumeSubHeadingListStart
    \resumeSubheading
      {Data Analyst}{Jan. 2023 -- Present}
      {Cedar Retail}{Karachi, Pakistan}
      \resumeItemListStart
        \resumeItem{Built weekly sales dashboards in Power BI used by 40 store managers across 3 regions, cutting manual reporting time by 6 hours a week and speeding up stock decisions}
        \resumeItem{Wrote and optimised SQL queries on PostgreSQL to clean and join 12M transaction rows for monthly revenue analysis, reducing query run time from 20 minutes to under 3}
        \resumeItem{Ran A/B tests on 15 promotions with the marketing team and presented findings to senior stakeholders, leading to a pricing change that lifted basket size by 7\%}
      \resumeItemListEnd

    \resumeSubheading
      {Junior Data Analyst}{Jul. 2021 -- Dec. 2022}
      {Blue Harbor Logistics}{Lahore, Pakistan}
      \resumeItemListStart
        \resumeItem{Automated delivery performance reports with Python and pandas, replacing a 3-hour daily Excel process and giving operations managers fresh numbers every morning}
        \resumeItem{Created Tableau views of route delays by city and carrier that helped the operations team reduce late deliveries by 14\% over two consecutive quarters}
        \resumeItem{Documented data definitions and automated quality checks for 25 core tables used across the analytics team, cutting recurring data questions by about a third}
      \resumeItemListEnd

    \resumeSubheading
      {Data Intern}{Jan. 2021 -- Jun. 2021}
      {Northfield Analytics}{Lahore, Pakistan}
      \resumeItemListStart
        \resumeItem{Cleaned and validated survey data for 3 client projects using Excel and Python, catching duplicate and out-of-range answers before results reached the client}
        \resumeItem{Prepared charts and summary tables for 6 client presentations, turning raw survey results into clear findings that the account team could present with confidence}
      \resumeItemListEnd
  \resumeSubHeadingListEnd

\section{Education}
  \resumeSubHeadingListStart
    \resumeSubheading
      {University of the Punjab}{Lahore, Pakistan}
      {BS Statistics}{2017 -- 2021}
  \resumeSubHeadingListEnd

\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
     \textbf{Languages}{: SQL, Python, R} \\
     \textbf{Tools}{: Power BI, Tableau, Excel, Git} \\
     \textbf{Methods}{: A/B testing, regression, data cleaning, dashboard design}
    }}
 \end{itemize}

\section{Certifications}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{Google Data Analytics Professional Certificate}}
 \end{itemize}

\end{document}
`;

export const DEFAULT_BULLET_BANK = `[Cedar Retail]
- Designed a customer churn model in Python (scikit-learn) that flagged at-risk accounts each week and lifted the retention campaign's conversion rate by 9%
- Partnered with finance to build a Snowflake data mart for margin reporting with dbt models, reducing month-end close queries from 2 days to about 4 hours

[Blue Harbor Logistics]
- Built an Airflow pipeline that loaded carrier data into BigQuery every hour, giving operations near real-time delivery tracking and alerts for delayed routes

[Northfield Analytics]
- Wrote Python scripts to clean and merge 50k survey responses with cohort labels, cutting manual data preparation time for the analysts by about half`;

export const DEFAULT_SKILL_BANK = `Languages: Scala
Tools: Snowflake, BigQuery, Airflow, Looker, dbt
Methods: forecasting, cohort analysis, data modeling`;

export const DEFAULT_CERTS = `Google Data Analytics Professional Certificate
Microsoft Certified: Power BI Data Analyst Associate (PL-300)
Tableau Desktop Specialist
Snowflake SnowPro Core Certification`;

export const DEFAULT_SUMMARY = '{role} with {years}+ years of experience in {skills}, turning data into decisions that teams can act on.';

export const EXAMPLE_JD = `Senior Data Analyst — Lumen Commerce (Karachi, hybrid)

About the role
We are looking for a Senior Data Analyst to help our growth and finance teams make faster decisions.

What you will do
- Build and maintain dashboards in Power BI and Looker for commercial stakeholders.
- Write efficient SQL on Snowflake and BigQuery; model data with dbt.
- Design and analyse A/B tests and present insights to senior leadership.
- Forecast demand and run cohort analysis on customer retention.

Requirements
- 4+ years in data analysis or business intelligence.
- Expert SQL and Python (pandas); experience with Snowflake or BigQuery.
- Experience with Airflow or similar orchestration tools is a plus.
- Clear communication with non-technical stakeholders.`;

/** Certifications commonly named in job posts, for suggestions only — add one to your own list only if you hold it or are working towards it. */
export const CERT_CATALOG: Array<[RegExp, string]> = [
  [/\baws|amazon web services\b/i, 'AWS Certified Solutions Architect – Associate'],
  [/\bazure\b/i, 'Microsoft Certified: Azure Fundamentals (AZ-900)'],
  [/\bgcp|google cloud|bigquery\b/i, 'Google Cloud Professional Data Engineer'],
  [/\bpower bi\b/i, 'Microsoft Certified: Power BI Data Analyst Associate (PL-300)'],
  [/\btableau\b/i, 'Tableau Desktop Specialist'],
  [/\bsnowflake\b/i, 'Snowflake SnowPro Core Certification'],
  [/\bdatabricks|spark\b/i, 'Databricks Certified Data Engineer Associate'],
  [/\bdbt\b/i, 'dbt Analytics Engineering Certification'],
  [/\bkubernetes|k8s\b/i, 'Certified Kubernetes Administrator (CKA)'],
  [/\bterraform\b/i, 'HashiCorp Certified: Terraform Associate'],
  [/\bdocker\b/i, 'Docker Certified Associate'],
  [/\bscrum|agile\b/i, 'Professional Scrum Master I (PSM I)'],
  [/\bproject management|pmp\b/i, 'Project Management Professional (PMP)'],
  [/\bsecurity|soc\b/i, 'CompTIA Security+'],
  [/\bnetwork(ing)?|cisco\b/i, 'Cisco Certified Network Associate (CCNA)'],
  [/\bsalesforce\b/i, 'Salesforce Certified Administrator'],
  [/\bgoogle analytics\b/i, 'Google Analytics Certification'],
  [/\bseo|hubspot|inbound\b/i, 'HubSpot Inbound Marketing Certification'],
  [/\bexcel\b/i, 'Microsoft Office Specialist: Excel Expert'],
  [/\bdata analy(st|sis|tics)\b/i, 'Google Data Analytics Professional Certificate'],
  [/\bmachine learning|ml engineer\b/i, 'Google Cloud Professional Machine Learning Engineer'],
  [/\bitil|service management\b/i, 'ITIL 4 Foundation'],
  [/\bsix sigma|lean\b/i, 'Lean Six Sigma Green Belt'],
  [/\bjava\b(?!script)/i, 'Oracle Certified Professional: Java SE Developer'],
  [/\breact|frontend|front-end\b/i, 'Meta Front-End Developer Professional Certificate'],
  [/\bux|user experience\b/i, 'Google UX Design Professional Certificate'],
];
