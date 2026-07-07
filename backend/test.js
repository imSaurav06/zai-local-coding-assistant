const axios = require('axios');

axios.post('http://localhost:5000/api/project/generate', {
    prompt: 'Create a simple React landing page for a gym website'
}).then(res => {
    console.log("SUCCESS");
    console.log(res.data);
}).catch(err => {
    console.error("ERROR:");
    console.error(err.response?.status);
    console.error(err.response?.data);
});
