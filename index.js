const express = require("express");
const { WebhookClient } = require("dialogflow-fulfillment");
const { OpenAI } = require("openai");

// 🔥 Express 服务器
const app = express();
app.use(express.json());

// 🔥 OpenAI API 配置（Cloud Run 通过 --set-env-vars 传递 API Key）
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY  // ✅ 读取环境变量
});

// 📌 书籍推荐相关问题
const questions = [
    { key: "year", text: "What year do you prefer for the novel? (e.g., 2020, 1990s, classic books)" },
    { key: "genre", text: "What genre are you interested in? (e.g., fantasy, mystery, romance)" },
    { key: "type", text: "What type of story do you prefer? (e.g., adventure, detective, dystopian)" },
    { key: "mood", text: "What’s your current mood? (e.g., happy, sad, nostalgic, adventurous)" },
    { key: "length", text: "Do you prefer a short book or a long novel?" },
    { key: "country", text: "Do you have a preferred country of origin for the book?" }
];

/**
 * ✅ Step 1: `StartBookRecommendation`
 * - 触发后，随机选取 3 个问题进行询问
 * - 存入 `book_recommendation_session`，保证多轮对话
 */
function startRecommendation(agent) {
    let selectedQuestions = [];

    // 🎯 随机选择 3 个不同的问题
    while (selectedQuestions.length < 3) {
        let randomIndex = Math.floor(Math.random() * questions.length);
        let selected = questions[randomIndex];
        if (!selectedQuestions.includes(selected)) {
            selectedQuestions.push(selected);
        }
    }

    // 🎯 存储问题到 Session
    agent.context.set({
        name: "book_recommendation_session",
        lifespan: 5,
        parameters: { selectedQuestions: selectedQuestions, step: 0, answers: {} }
    });

    // 🎯 提问第一个问题
    agent.add("Let's find the perfect book for you! I'll ask you three questions.");
    agent.add(selectedQuestions[0].text);
}

/**
 * ✅ Step 2: `RecommendByXXX`
 * - 记录用户偏好并存入 `book_recommendation_session`
 * - 如果 3 个问题收集完，触发 `GenerateRecommendationIntent`
 */
function collectUserPreference(agent) {
    const context = agent.context.get("book_recommendation_session") || {
        name: "book_recommendation_session",
        lifespan: 5,
        parameters: { answers: {} }
    };

    let answers = context.parameters.answers || {};
    let selectedQuestions = context.parameters.selectedQuestions || [];
    let step = context.parameters.step || 0;

    if (selectedQuestions.length === 0) {
        agent.add("Sorry, something went wrong. Please restart the book recommendation.");
        return;
    }

    let key = selectedQuestions[step].key;

    // ✅ 直接读取 `Dialogflow parameters`
    let userResponse = agent.parameters[key] || agent.query.trim();
    answers[key] = userResponse;

    console.log(`📝 Stored: ${key} -> ${answers[key]}`);

    if (step < 2) {
        agent.context.set({
            name: "book_recommendation_session",
            lifespan: 5,
            parameters: { selectedQuestions, step: step + 1, answers }
        });
        agent.add(selectedQuestions[step + 1].text);
    } else {
        agent.context.set({
            name: "book_recommendation_session",
            lifespan: 5,
            parameters: { answers }
        });
        agent.add("Thanks! Based on your preferences, let me find a book for you.");
    }
}

/**
 * ✅ Step 3: `GenerateRecommendationIntent`
 * - 读取 `book_recommendation_session`
 * - 通过 OpenAI 生成最佳书籍推荐
 */

async function generateRecommendation(agent) {
    let context = agent.context.get("book_recommendation_session");

    if (!context || !context.parameters.answers || Object.keys(context.parameters.answers).length === 0) {
        agent.add("I don't have enough information. Can you tell me more?");
        return;
    }

    let answers = context.parameters.answers;
    console.log("📌 Final Answers:", answers);

    // 生成 OpenAI 提问
    let prompt = `Recommend a book based on these preferences:
    Genre: ${answers.genre || "Any"}
    Mood: ${answers.mood || "Any"}
    Type: ${answers.type || "Any"}
    Year: ${answers.year || "Any"}
    Country: ${answers.country || "Any"}
    Length: ${answers.length || "Any"}
    
    Provide a book title, author, and a short description.`;

    try {
        let response = await openai.createCompletion({
            model: "gpt-4",
            prompt: prompt,
            max_tokens: 100
        });

        let recommendation = response.data.choices[0].text.trim();
        agent.add(`Based on your preferences, here is a book recommendation: ${recommendation}`);
    } catch (error) {
        console.error("OpenAI API Error:", error);
        agent.add("Sorry, there was an issue fetching recommendations. Please try again.");
    }
}

/**
 * ✅ Webhook 入口：支持 Dialogflow 请求
 */
app.post("/", (req, res) => {
    const agent = new WebhookClient({ request: req, response: res });

    let intentMap = new Map();
    intentMap.set("StartBookRecommendation", startRecommendation); // 开始推荐
    intentMap.set("RecommendByYear", collectUserPreference);
    intentMap.set("RecommendByGenre", collectUserPreference);
    intentMap.set("RecommendByType", collectUserPreference);
    intentMap.set("RecommendByMood", collectUserPreference);
    intentMap.set("RecommendByCountry", collectUserPreference);
    intentMap.set("RecommendByLength", collectUserPreference);
    intentMap.set("GenerateRecommendationIntent", generateRecommendation); // 调用 OpenAI 生成推荐

    agent.handleRequest(intentMap);
});

// ✅ 确保 Cloud Run 监听 `8080` 端口
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
