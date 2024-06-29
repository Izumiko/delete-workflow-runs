import { getInput, setFailed } from '@actions/core'
import { Octokit } from '@octokit/rest'

const run = async () => {
  try {
    const token = getInput('token')
    const repository = getInput('repository')
    const retain_days = Number.parseInt(getInput('retain_days'))
    const keep_minimum_runs = Number.parseInt(getInput('keep_minimum_runs'))
  
    const splitRepository = repository.split('/')
    if (splitRepository.length !== 2 || !splitRepository[0] || !splitRepository[1]) {
      throw new Error(`Invalid repository '${repository}'. Expected format {owner}/{repo}.`)
    }
    const repo_owner = splitRepository[0]
    const repo_name = splitRepository[1]

    let page_number = 1
    let del_runs = []

    const octokit = new Octokit({
      auth: token,
    })

    while (true) {
      // Execute the API "List workflow runs for a repository", see 'https://octokit.github.io/rest.js/v18#actions-list-workflow-runs-for-repo'
      const response = await octokit.actions.listWorkflowRunsForRepo({
        owner: repo_owner,
        repo: repo_name,
        per_page: 100,
        page: page_number,
      })

      const length = response.data.workflow_runs.length

      if (length < 0) {
        break
      } else {
        for (let i = 0; i < length; i++) {
          const run = response.data.workflow_runs[i]
          const created_at = new Date(run.created_at)
          const now = new Date()
          const diff = now.getTime() - created_at.getTime()
          const diffDays = diff / (1000 * 60 * 60 * 24)

          if (diffDays >= retain_days) {
            del_runs.push(run.id)
          }
        }
      }

      if (length < 100) {
        break
      }

      page_number++
    }

    const arr_length = del_runs.length - keep_minimum_runs
    if (arr_length < 1) {
      console.log('No workflow runs need to be deleted.')
    } else {
      for (let i = 0; i < arr_length; i++) {
        const run_id = del_runs[i]
        // Execute the API "Delete a workflow run", see 'https://octokit.github.io/rest.js/v18#actions-delete-workflow-run'
        await octokit.actions.deleteWorkflowRun({
          owner: repo_owner,
          repo: repo_name,
          run_id: run_id,
        })
        console.log(`🚀 Deleted workflow run ${run_id}.`)
      }

      console.log(`✅ ${arr_length} workflow runs are deleted.`)
    }
  } catch (error: any) {
    setFailed(error.message)
  }
}

run()
