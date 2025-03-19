import express from "express";
import { WebhookClient } from "dialogflow-fulfillment";

const app = express();
app.use(express.json());

// 书籍推荐问题
const questions = [
    { key: "year", text: "What year do you prefer for the novel? (e.g., 2020, 1990s, classic books)" },
    { key: "genre", text: "What genre are you interested in? (e.g., fantasy, mystery, romance)" },
    { key: "type", text: "What type of story do you prefer? (e.g., adventure, detective, dystopian)" },
    { key: "mood", text: "What’s your current mood? (e.g., happy, sad, nostalgic, adventurous)" },
    { key: "length", text: "Do you prefer a short book or a long novel?" }
];

// 开始推荐书籍
function startRecommendation(agent) {
    let selectedQuestions = [];

    while (selectedQuestions.length < 3) {
        let randomIndex = Math.floor(Math.random() * questions.length);
        let selected = questions[randomIndex];
        if (!selectedQuestions.includes(selected)) {
            selectedQuestions.push(selected);
        }
    }

    // 存储问题在 Dialogflow 上下文
    agent.context.set({
        name: "book_recommendation_session",
        lifespan: 5,
        parameters: { selectedQuestions: selectedQuestions, step: 0, answers: {} }
    });

    agent.add("Let's find the perfect book for you! I'll ask you three questions.");
    agent.add(selectedQuestions[0].text);
}

// 处理用户回答
function handleResponse(agent) {
    let context = agent.context.get("book_recommendation_session");
    if (!context || !context.parameters.selectedQuestions) {
        agent.add("Sorry, the session was lost. Please restart the book recommendation.");
        return;
    }

    let step = context.parameters.step;
    let selectedQuestions = context.parameters.selectedQuestions;
    let answers = context.parameters.answers || {};

    // 存储用户回答
    let key = selectedQuestions[step].key;
    answers[key] = agent.query;

    // 继续提问，或者生成推荐
    if (step < 2) {
        agent.context.set({
            name: "book_recommendation_session",
            lifespan: 5,
            parameters: { selectedQuestions: selectedQuestions, step: step + 1, answers: answers }
        });

        agent.add(selectedQuestions[step + 1].text);
    } else {
        let recommendation = "I suggest *To Kill a Mockingbird* by Harper Lee. It's a classic!";
        
        if (answers.genre === "fantasy" && answers.mood === "adventurous" && answers.length === "long") {
            recommendation = "I recommend *The Lord of the Rings* by J.R.R. Tolkien.";
        } else if (answers.type === "mystery" && answers.mood === "thrilling") {
            recommendation = "You might enjoy *The Hound of the Baskervilles* by Arthur Conan Doyle.";
        } else if (answers.genre === "romance" && answers.year === "classic") {
            recommendation = "Try *Pride and Prejudice* by Jane Austen!";
        }

        agent.add(`Based on your preferences, here's a book for you: ${recommendation}`);
        agent.context.delete("book_recommendation_session");
    }
}

// 处理 Webhook 请求
app.post("/", (req, res) => {
    const agent = new WebhookClient({ request: req, response: res });

    let intentMap = new Map();
    intentMap.set("StartBookRecommendation", startRecommendation);
    intentMap.set("HandleBookResponse", handleResponse);

    agent.handleRequest(intentMap);
});

// 测试 URL，确认 Webhook 是否运行
app.get("/", (req, res) => {
    res.send("Dialogflow Webhook is running!");
});

// 启动 Express 服务器
const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// **最重要的部分**
export default app;