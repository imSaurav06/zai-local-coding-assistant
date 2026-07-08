const projectService = require("./services/projectService");
require("dotenv").config();

async function run() {
    const spec = {
      projectName: "LandingPage",
      projectType: "React Landing Page",
      frontend: "React with Vite and Tailwind CSS",
      backend: "None",
      database: "None",
      authentication: "None",
      mainFeatures: [
        "Hero section",
        "Pricing grid",
        "Testimonials",
        "Responsive menu"
      ],
      importantDependencies: [
        "react",
        "react-dom",
        "vite",
        "tailwindcss",
        "@vitejs/plugin-react"
      ],
      environmentVariables: []
    };

    try {
        console.log("Generating...");
        const result = await projectService.generateProject({
            originalPrompt: "Create a React landing page with Tailwind CSS.",
            projectSpec: spec
        });
        console.log("Success:", result);
    } catch (err) {
        console.error("Error caught in test_direct_gen:");
        console.error(err);
    }
}
run();
