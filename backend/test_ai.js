const axios = require('axios');

console.time('ai_chat');
axios.post('http://localhost:5000/api/ai/chat', {
    prompt: 'Create a simple React landing page for a gym website'
}).then(res => {
    console.timeEnd('ai_chat');
    console.log("AI CHAT SUCCESS");
    console.log("Result length:", res.data.result?.length);
}).catch(err => {
    console.timeEnd('ai_chat');
    console.error("AI CHAT ERROR:", err.message);
    if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", err.response.data);
    }
});
