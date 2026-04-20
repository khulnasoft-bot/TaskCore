export function onboardingService() {
  return {
    generateRecommendation: async (mission: string) => {
      // For now, we use a rule-based recommendation system.
      // In a production environment, this would call an LLM with a system prompt
      // to break down the mission into a concrete starting project and task.
      
      const missionLower = mission.toLowerCase();
      
      let recommendation = {
        suggestedProjectName: "Initial Roadmap",
        suggestedTaskTitle: "Define core objectives and technical stack",
        suggestedTaskDescription: `Based on your mission: "${mission}"\n\nI recommend starting with a clear plan:\n1. Identify the primary goals\n2. Define the first milestone\n3. Set up the development environment`,
        followUpQuestions: [
          "What is the primary target audience for this project?",
          "Are there any specific technologies you definitely want to use?",
          "What would you consider a successful 'Day 1' outcome?"
        ]
      };

      if (missionLower.includes("web") || missionLower.includes("app") || missionLower.includes("site")) {
        recommendation.suggestedProjectName = "Web Development";
        recommendation.suggestedTaskTitle = "Create project scaffold and basic architecture";
      } else if (missionLower.includes("data") || missionLower.includes("analysis") || missionLower.includes("research")) {
        recommendation.suggestedProjectName = "Data Analysis";
        recommendation.suggestedTaskTitle = "Gather initial datasets and define analysis metrics";
      } else if (missionLower.includes("automation") || missionLower.includes("script") || missionLower.includes("tool")) {
        recommendation.suggestedProjectName = "Automation Tools";
        recommendation.suggestedTaskTitle = "Map out the manual process to be automated";
      }

      return recommendation;
    }
  };
}
