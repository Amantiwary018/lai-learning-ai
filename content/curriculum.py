# LAI curriculum definition. "full" chapters get AI-drafted, human-reviewed lesson content + video.
# Outline-only courses get their structure generated and are marked as "in content pipeline".

CATEGORIES = [
    {"slug": "certifications", "name": "Certification Courses", "description": "Complete lessons, tests, a project and a final assessment to earn a LAI Certificate of Completion."},
    {"slug": "engineering", "name": "Engineering", "description": "Core engineering disciplines, from Computer Science to Electrical and DevOps."},
    {"slug": "programming", "name": "Programming & Technology", "description": "Languages, tools and fundamentals every developer needs."},
    {"slug": "learn-ai", "name": "Learn AI", "description": "AI skills required for every profession."},
]

FULL = [
  {
    "slug": "c-programming", "title": "C Programming", "category": "programming", "certifiable": True, "language": "c",
    "level": "Beginner", "description": "Learn C from the ground up: program structure, data types, control flow, functions, arrays, pointers and structures.",
    "project": "Build a Student Marks Manager in C: store up to 50 students (name, roll number, 3 subject marks) using an array of structures; add, list, search by roll number, and print class average and topper. Submit your complete .c source code.",
    "subjects": [{"title": "C Language Core", "chapters": [
      {"title": "Introduction", "topics": ["What is C and the Structure of a C Program", "Compiling and Running a C Program"]},
      {"title": "Basic Concepts", "topics": ["Variables and Data Types", "Operators and Expressions", "Input and Output with printf and scanf"]},
      {"title": "Control Flow", "topics": ["Decision Making with if-else and switch", "Loops: for, while and do-while"]},
      {"title": "Functions and Arrays", "topics": ["Functions in C", "Arrays", "Strings in C"]},
      {"title": "Pointers and Structures", "topics": ["Pointers Basics", "Structures"]},
    ]}],
  },
  {
    "slug": "python-programming", "title": "Python Programming", "category": "programming", "certifiable": True, "language": "python",
    "level": "Beginner", "description": "Python for beginners: syntax, data types, control flow, functions, collections, files and OOP basics.",
    "project": "Build a Personal Expense Tracker in Python: add expenses (amount, category, date), list them, show totals per category, and save/load data from a CSV file. Submit your complete .py source code.",
    "subjects": [{"title": "Python Core", "chapters": [
      {"title": "Introduction", "topics": ["What is Python and Your First Program", "Variables and Data Types in Python"]},
      {"title": "Basic Concepts", "topics": ["Operators and Expressions in Python", "Input, Output and Type Conversion"]},
      {"title": "Control Flow", "topics": ["Conditional Statements in Python", "Loops in Python"]},
      {"title": "Functions and Collections", "topics": ["Functions in Python", "Lists and Tuples", "Dictionaries and Sets"]},
      {"title": "Files and OOP", "topics": ["File Handling in Python", "Classes and Objects in Python"]},
    ]}],
  },
  {
    "slug": "java-programming", "title": "Java Programming", "category": "programming", "certifiable": True, "language": "java",
    "level": "Beginner", "description": "Java fundamentals: JVM, types, control flow, methods, arrays, strings and object-oriented programming.",
    "project": "Build a Library Management System in Java: classes Book and Library; add books, issue/return books, search by title, and list available books. Submit your complete .java source code.",
    "subjects": [{"title": "Core Java", "chapters": [
      {"title": "Introduction", "topics": ["What is Java and How the JVM Works", "Structure of a Java Program"]},
      {"title": "Basic Concepts", "topics": ["Variables and Data Types in Java", "Operators in Java", "Taking Input with Scanner"]},
      {"title": "Control Flow", "topics": ["Conditional Statements in Java", "Loops in Java"]},
      {"title": "Methods, Arrays and Strings", "topics": ["Methods in Java", "Arrays in Java", "Strings in Java"]},
      {"title": "Object-Oriented Programming", "topics": ["Classes and Objects in Java", "Inheritance and Polymorphism"]},
    ]}],
  },
  {
    "slug": "learn-ai", "title": "Learn AI: AI Skills for Every Profession", "category": "learn-ai", "certifiable": True, "language": None,
    "level": "All levels", "description": "Learn how to use AI effectively, verify its output, automate workflows, and combine AI with your professional skills.",
    "project": "Design an AI-assisted workflow for your own profession: describe a real task, write 3 reusable prompts for it, show how you verify the AI output, and explain which steps stay human. Submit it as a written document (text).",
    "subjects": [
      {"title": "AI Fundamentals", "chapters": [{"title": "Understanding AI", "topics": ["What is Artificial Intelligence", "Generative AI and Large Language Models", "AI Capabilities and Limitations", "Responsible and Ethical Use of AI"]}]},
      {"title": "Prompt Engineering", "chapters": [{"title": "Writing Effective Prompts", "topics": ["Writing Clear and Effective Prompts", "Giving Context and Instructions", "Role-Based Prompting", "Step-by-Step Task Instructions", "Controlling Output Format and Quality", "Creating Reusable Prompts"]}]},
    ],
    "outline_subjects": [
      ("AI Assistants", ["Using ChatGPT effectively", "Using Google Gemini effectively", "Using Claude effectively", "Using Microsoft Copilot effectively"]),
      ("AI Research & Information Verification", ["AI-powered research", "Summarizing large amounts of information", "Comparing multiple sources", "Fact-checking AI-generated information", "Identifying hallucinated information"]),
      ("AI for Productivity", ["Writing emails and documents", "Creating presentations", "Summarizing meetings and notes", "Planning and organizing tasks", "Generating reports and ideas"]),
      ("AI for Data & Analysis", ["AI with Excel and Google Sheets", "Data cleaning and analysis", "Creating charts and reports", "Finding patterns and insights", "Basic statistical analysis"]),
      ("AI Coding & Development", ["AI-assisted programming", "Debugging and explaining code with AI", "Using AI coding assistants", "Git and GitHub with AI", "Building applications with AI APIs"]),
      ("AI Automation", ["Automating repetitive tasks", "Connecting different applications", "Creating AI-powered workflows", "Using automation platforms"]),
      ("AI Agents", ["Understanding AI agents", "Multi-step AI workflows", "Tool-using AI systems", "Building task-oriented AI assistants", "Human + AI collaboration"]),
      ("AI for Creative Work", ["AI image generation", "AI video generation", "AI presentation creation", "AI design assistance", "Content creation"]),
      ("AI APIs & Integration", ["Understanding APIs", "Connecting AI models with applications", "Using AI APIs in websites", "Building AI-powered features"]),
      ("Profession-Specific AI Skills", ["AI for Software Developers", "AI for Teachers", "AI for Business and Management", "AI for Marketing", "AI for Finance", "AI for Designers", "AI for Engineers", "AI for Students"]),
    ],
  },
  {
    "slug": "engineering-mathematics", "title": "Engineering Mathematics Foundations", "category": "engineering", "certifiable": False, "language": None,
    "level": "Beginner", "description": "Core algebra every engineer needs, taught step by step with handwritten derivations.",
    "subjects": [{"title": "Algebra", "chapters": [
      {"title": "Equations", "topics": ["Solving Linear Equations", "Solving Quadratic Equations"]},
      {"title": "Logarithms", "topics": ["Laws of Logarithms"]},
    ]}],
  },
  {
    "slug": "basic-electrical-engineering", "title": "Basic Electrical Engineering", "category": "engineering", "certifiable": False, "language": None,
    "level": "Beginner", "description": "DC circuits, Ohm's law, resistor networks and the basics of AC.",
    "subjects": [{"title": "DC Circuits", "chapters": [
      {"title": "Circuit Fundamentals", "topics": ["Ohm's Law", "Series and Parallel Resistors"]},
    ]}],
    "outline_subjects": [("AC Fundamentals", ["Alternating current and sine waves", "RMS and average values", "Power factor"])],
  },
]

# Outline-only courses (structure generated, content added through the admin AI-draft + review pipeline)
OUTLINE = [
  ("computer-science-engineering", "Computer Science Engineering", "engineering", "Operating systems, networks, DBMS, computer organization and theory of computation."),
  ("ai-machine-learning", "Artificial Intelligence and Machine Learning", "engineering", "Supervised and unsupervised learning, neural networks, model evaluation and deployment."),
  ("data-science", "Data Science", "engineering", "Statistics, data wrangling, visualization, and predictive modelling."),
  ("cyber-security", "Cyber Security", "engineering", "Security fundamentals, cryptography, network security and ethical hacking basics."),
  ("software-engineering", "Software Engineering", "engineering", "SDLC, requirements, design patterns, testing and project management."),
  ("basic-mechanical-engineering", "Basic Mechanical Engineering", "engineering", "Thermodynamics, mechanics, materials and manufacturing basics."),
  ("electronics", "Electronics", "engineering", "Diodes, transistors, amplifiers and digital logic."),
  ("devops-engineering", "DevOps Engineering", "engineering", "CI/CD, containers, cloud infrastructure, monitoring and automation."),
  ("cpp-programming", "C++ Programming", "programming", "Modern C++: OOP, STL, templates and memory management."),
  ("javascript", "JavaScript", "programming", "The language of the web: syntax, DOM, async programming and modules."),
  ("typescript", "TypeScript", "programming", "Static types for JavaScript: types, interfaces, generics and tooling."),
  ("html", "HTML", "programming", "Semantic HTML5 structure, forms, media and accessibility."),
  ("css", "CSS", "programming", "Selectors, box model, Flexbox, Grid and responsive design."),
  ("react", "React", "programming", "Components, props, state, hooks and building SPAs."),
  ("sql", "SQL", "programming", "Querying relational databases: SELECT, JOINs, aggregation and design."),
  ("git-github", "Git and GitHub", "programming", "Version control, branching, pull requests and collaboration."),
  ("linux-basics", "Linux Basics", "programming", "Shell, file system, permissions, processes and scripting."),
  ("dsa", "Data Structures and Algorithms", "programming", "Arrays, linked lists, trees, graphs, sorting and complexity."),
  ("web-development", "Web Development", "programming", "Full-stack web: frontend, backend, APIs and deployment."),
  ("ai-ml-programming", "AI and Machine Learning with Python", "programming", "Hands-on ML with Python, NumPy, pandas and scikit-learn."),
]
