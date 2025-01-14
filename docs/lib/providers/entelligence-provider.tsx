"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    Entelligence?: {
      init(config: { analyticsData: any }): void;
    };
    EntelligenceChat?: {
        init(config: { analyticsData: any }): void;
    };
  }
}

export function EntelligenceProvider() {
  useEffect(() => {
    console.log("EntelligenceProvider Init");
    const script = document.createElement("script");
    script.type = "module";
    script.id = "entelligence-chat";
    script.src = "https://d345f39z3arwqc.cloudfront.net/entelligence-chat.js";
    script.async = true;
    script.onload = () => {
      if (window?.EntelligenceChat) {        
        window.EntelligenceChat.init({
          analyticsData: {
            repoName: "CopilotKit",
            organization: "CopilotKit", 
            apiKey: "#",
            theme: "light",
            disableArtifacts: true,
            limitSources: 3,
          },
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }      
    };
  }, []);

  return <></>;
}
