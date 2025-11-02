import * as core from "@actions/core";
import * as github from "@actions/github";
import { WebClient } from '@slack/web-api';

type SlackIdsMap = {
    [githubUsername: string]: string | undefined;
};

async function run() {
    const slackBotTokenInput = core.getInput('slack-token');
    const slackChannelIdInput = core.getInput('channel');
    const slackMemberIdsMapInput = JSON.parse(
        core.getInput('slack-member-ids-map') || '{}',
    ) as SlackIdsMap;
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

async function buildSlackMessage(slackMemberIdsMapInput: SlackIdsMap): Promise<any[]> {
    // Read GitHub context.
    const githubRepository = github.context.payload.repository;
    const pr = github.context.payload.pull_request;
    if (!githubRepository || !pr) {
        core.setFailed('No context found.');
        throw new Error('No context found.');
    }
    const prAuthorUsername = pr.user?.login;
    const prReviewersUsernames: string[] = pr.requested_reviewers?.map(
        (reviewer: any) => reviewer.login,
    );
    const prAuthor = await getSlackIdMentionOrGithubUsername(
        prAuthorUsername,
        slackMemberIdsMapInput,
    );
    const prReviewers = await Promise.all(
        prReviewersUsernames.map((username) =>
            getSlackIdMentionOrGithubUsername(username, slackMemberIdsMapInput),
        ),
    );
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
                text:
                    `*Repository*: <${githubRepository.html_url} | ${githubRepository.full_name}>\n` +
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
async function getSlackIdMentionOrGithubUsername(
    githubUsername: string,
    slackMemberIdsMap: SlackIdsMap,
): Promise<string> {
    const slackId = slackMemberIdsMap[githubUsername];
    return slackId ? `<@${slackId}>` : githubUsername;
}

/**
 * Send a message to Slack.
 * @param slackMessageBlocks The Slack message blocks.
 */
async function sendSlackMessage(
    slackToken: string,
    slackChannelId: string,
    slackMessageBlocks: any[],
) {
    const slackClient = new WebClient(slackToken);
    await slackClient.chat.postMessage({
        channel: slackChannelId,
        blocks: slackMessageBlocks,
    });
}

if (require.main === module) {
    run();
}
