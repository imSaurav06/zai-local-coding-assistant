const createProgressEmitter = (res) => {
    // Write headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // Establish the SSE stream immediately

    return {
        emit: (stage, text = "", extra = {}) => {
            const data = {
                stage,
                text,
                timestamp: new Date().toISOString(),
                ...extra
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        end: (finalResult) => {
            res.write(`data: ${JSON.stringify({ stage: "Ready", result: finalResult })}\n\n`);
            res.end();
        }
    };
};

module.exports = { createProgressEmitter };
