// gemini-test.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config(); // loads GEMINI_API_KEY from .env

async function runTest() {
  try {
    // Correct
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // console.log(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Explain how AI works in simple words";

    const result = await model.generateContent(prompt);

    console.log("✅ Gemini response:\n");
    console.log(result.response.text());
  } catch (error) {
    console.error("❌ Gemini API test failed:", error);
  }
}

runTest();
