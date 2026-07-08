const axios = require('axios');
require('dotenv').config();

console.log("BASE URL:", process.env.ZAI_BASE_URL);
console.log("MODEL:", process.env.ZAI_MODEL);
console.log("API KEY LENGTH:", process.env.ZAI_API_KEY ? process.env.ZAI_API_KEY.length : 0);

console.time('direct_zai');
axios.post(`${process.env.ZAI_BASE_URL}/chat/completions`, {
    model: process.env.ZAI_MODEL,
    messages: [
        { role: 'user', content: 'Say hello' }
    ]
}, {
    headers: {
        Authorization: `Bearer ${process.env.ZAI_API_KEY}`,
        'Content-Type': 'application/json'
    }
}).then(res => {
    console.timeEnd('direct_zai');
    console.log("ZAI SUCCESS:", res.data.choices[0].message.content);
}).catch(err => {
    console.timeEnd('direct_zai');
    console.error("ZAI ERROR:", err.message);
    if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", err.response.data);
    }
});
