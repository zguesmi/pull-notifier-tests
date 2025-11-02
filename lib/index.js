import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebClient } from '@slack/web-api';
const env = {
    slackMemberIdsMap: process.env.SLACK_MEMBER_IDS_MAP,
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackChannelId: process.env.SLACK_CHANNEL_ID
};
async function run() {
    const githubRepository = github.context.payload.repository;
    const pr = github.context.payload.pull_request;
    if (!githubRepository || !pr) {
        core.setFailed('No context found.');
        return;
    }
    const prAuthorUsername = pr.user?.login;
    const prReviewersUsernames = pr.requested_reviewers?.map((reviewer) => reviewer.login);
    const prAuthor = await getSlackIdMentionOrGithubUsername(prAuthorUsername);
    const prReviewers = await Promise.all(prReviewersUsernames.map(getSlackIdMentionOrGithubUsername));
    core.info(`PR Author: ${prAuthor}`);
    core.info(`PR Reviewers: ${prReviewers.join(', ')}`);
    const slackMessageBlocks = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `:git: PR ready for review — ${pr.title}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${pr.title}* <${pr.html_url} | #${pr.number}>`,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Repository*: <${githubRepository.html_url} | ${githubRepository.full_name}>\n` +
                    `*Author*: ${prAuthor}\n` +
                    `*Reviewers*: ${prReviewers.join(', ')}`,
            },
        },
    ];
    core.info(`Slack Message: ${JSON.stringify(slackMessageBlocks, null, 2)}`);
    sendSlackMessage(slackMessageBlocks);
}
/**
 * Get the Slack ID for a GitHub user.
 * @param githubUsername - The GitHub username.
 * @returns - The Slack ID or the GitHub username if not found.
 */
async function getSlackIdMentionOrGithubUsername(githubUsername) {
    const slackIdsMap = JSON.parse(env.slackMemberIdsMap || '{}');
    const slackId = slackIdsMap[githubUsername];
    return slackId ? `<@${slackId}>` : githubUsername;
}
async function sendSlackMessage(slackMessageBlocks) {
    const slackToken = env.slackBotToken;
    if (!slackToken) {
        core.setFailed('SLACK_BOT_TOKEN is not set.');
        return;
    }
    const slackClient = new WebClient(slackToken);
    const slackChannel = env.slackChannelId;
    if (!slackChannel) {
        core.setFailed('SLACK_CHANNEL_ID is not set.');
        return;
    }
    await slackClient.chat.postMessage({
        channel: slackChannel,
        blocks: slackMessageBlocks,
    });
    core.info('Slack message sent successfully.');
}
if (require.main === module) {
    run();
}
