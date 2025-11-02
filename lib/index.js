"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const web_api_1 = require("@slack/web-api");
async function run() {
    const slackBotTokenInput = core.getInput('slack-token');
    const slackChannelIdInput = core.getInput('channel');
    const slackMemberIdsMapInput = JSON.parse(core.getInput('slack-member-ids-map') || '{}');
    if (!slackBotTokenInput) {
        core.setFailed('SLACK_BOT_TOKEN is not set.');
        return;
    }
    if (!slackChannelIdInput) {
        core.setFailed('SLACK_CHANNEL_ID is not set.');
        return;
    }
    const slackMessageBlocks = await buildSlackMessage(slackMemberIdsMapInput);
    await sendSlackMessage(slackBotTokenInput, slackChannelIdInput, slackMessageBlocks);
    core.info('Slack message sent successfully.');
}
async function buildSlackMessage(slackMemberIdsMapInput) {
    // Read GitHub context.
    const githubRepository = github.context.payload.repository;
    const pr = github.context.payload.pull_request;
    if (!githubRepository || !pr) {
        core.setFailed('No context found.');
        throw new Error('No context found.');
    }
    const prAuthorUsername = pr.user?.login;
    const prReviewersUsernames = pr.requested_reviewers?.map((reviewer) => reviewer.login);
    const prAuthor = await getSlackIdMentionOrGithubUsername(prAuthorUsername, slackMemberIdsMapInput);
    const prReviewers = await Promise.all(prReviewersUsernames.map((username) => getSlackIdMentionOrGithubUsername(username, slackMemberIdsMapInput)));
    core.info(`PR Author: ${prAuthor}`);
    core.info(`PR Reviewers: ${prReviewers.join(', ')}`);
    // Construct Slack message blocks.
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
    return slackMessageBlocks;
}
/**
 * Get the Slack ID for a GitHub user.
 * @param githubUsername - The GitHub username.
 * @returns - The Slack ID or the GitHub username if not found.
 */
async function getSlackIdMentionOrGithubUsername(githubUsername, slackMemberIdsMap) {
    const slackId = slackMemberIdsMap[githubUsername];
    return slackId ? `<@${slackId}>` : githubUsername;
}
/**
 * Send a message to Slack.
 * @param slackMessageBlocks The Slack message blocks.
 */
async function sendSlackMessage(slackToken, slackChannelId, slackMessageBlocks) {
    const slackClient = new web_api_1.WebClient(slackToken);
    await slackClient.chat.postMessage({
        channel: slackChannelId,
        blocks: slackMessageBlocks,
    });
}
if (require.main === module) {
    run();
}
