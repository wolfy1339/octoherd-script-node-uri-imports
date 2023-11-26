// @ts-check
import { composeCreatePullRequest } from 'octokit-plugin-create-pull-request';
import { builtinModules } from 'node:module';

const nodeModulesRegex = new RegExp(`from "(${builtinModules.join('|')})"`, 'g');

/**
 * Replace NodeJS internal module imports with `node:` specifier imports
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {import('@octoherd/cli').Repository} repository
 */
export async function script(octokit, repository) {
  /** @type {import('@octokit/types').OctokitResponse<import('@octokit/openapi-types').components["schemas"]["content-tree"]>} */
  // @ts-ignore Overriding the type of the response for the correct type with the `object` media type
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner: repository.owner.login,
    repo: repository.name,
    mediaType: {
      format: 'object'
    }
  });

  const paths = data.entries
      ?.filter(entry => entry.type === 'dir')
      .filter(entry => entry.name !== '.github')
      .map(entry => {
        return entry.path;
      }) || [];

  /** @type {import('octokit-plugin-create-pull-request').createPullRequest.Changes & { files: NonNullable<import('octokit-plugin-create-pull-request').createPullRequest.Changes['files']>}} */
  const changes = {
    files: {},
    commit: `refactor: replace NodeJS internal module imports with \`node:\` specifier imports`,
    emptyCommit: false
  };

  /**
   * @param {string} path
   */
  async function getFiles(path) {
    /** @type {import('@octokit/types').OctokitResponse<import('@octokit/openapi-types').components["schemas"]["content-tree"]>} */
    // @ts-ignore Overriding the type of the response for the correct type with the `object` media type
    const { data: files } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: repository.owner.login,
      repo: repository.name,
      path,
      mediaType: {
        format: 'object'
      }
    });

    // @ts-expect-error We know that the path is a directory
    for (const entry of files.entries) {
      if (entry.type === 'file') {
        if (entry.name.endsWith('.js') || entry.name.endsWith('.ts') ||
          entry.name.endsWith('.cjs') || entry.name.endsWith('.mjs')) {
          changes.files[entry.path] = ({ exists, encoding, content }) => {
            if (!exists) return null;

            const textContent = Buffer.from(content, encoding).toString();

            return textContent.replace(nodeModulesRegex, 'from "node:$1"');
          };
        }
      }
      if (entry.type === 'dir') {
        await getFiles(entry.path);
      }
    }
  }
  for (const path of paths) {
    await getFiles(path);
  }
  if (!paths) {
    throw new Error('No paths found');
  }
  const pr = await composeCreatePullRequest(octokit, {
    owner: repository.owner.login,
    repo: repository.name,
    title: `refactor: replace NodeJS internal module imports with \`node:\` specifier imports`,
    body: `This PR replaces NodeJS internal module imports with \`node:\` specifier imports.`,
    head: 'node-module-imports',
    changes,
    update: true,
    labels: ['Type: Maintenance'],
    createWhenEmpty: false
  });

  if (!pr) {
    console.log(`No changes made to ${repository.owner.login}/${repository.name}`);
  }

  console.log(`PR created: ${pr.data.html_url}`);
}
