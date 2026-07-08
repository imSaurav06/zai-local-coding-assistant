const createProgressEmitter = (res) => {
    // Write headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // Establish the SSE stream immediately

    let heartbeatTimer = setInterval(() => {
        // Write standard SSE keep-alive comment line (ignored by parser but keeps connection active)
        res.write(":\n\n");
    }, 15000);

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
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            res.write(`data: ${JSON.stringify({ stage: "Ready", result: finalResult })}\n\n`);
            res.end();
        },
        clear: () => {
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
        }
    };
};

module.exports = { createProgressEmitter };
