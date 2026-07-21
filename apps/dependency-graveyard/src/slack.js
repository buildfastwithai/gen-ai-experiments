// slack.js - Posts the report to a Slack channel via Incoming Webhook

/**
 * Posts a message to Slack using an Incoming Webhook URL.
 * @param {string} webhookUrl - The Slack Incoming Webhook URL
 * @param {string} text - The formatted message text
 */
async function postToSlack(webhookUrl, text) {
    const payload = {
        text,
        mrkdwn: true,
    };

    const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Slack webhook failed: ${res.status} ${body}`);
    }
}

export { postToSlack };
