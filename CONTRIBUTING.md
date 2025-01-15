# Contributing to CopilotKit

⭐ Thank you for your interest in contributing!!

Here’s how you can contribute to this repository

## How can I contribute?

Ready to contribute but seeking guidance, we have several avenues to assist you. Explore the upcoming segment for clarity on the kind of contributions we appreciate and how to jump in. Reach out to us directly on [Discord](https://discord.gg/6dffbvGU3D) for immediate assistance! Alternatively, you're welcome to raise an issue and one of our dedicated maintainers will promptly steer you in the right direction!

## Found a bug?

If you find a bug in the source code, you can help us by [submitting an issue](https://github.com/CopilotKit/CopilotKit/issues/new?assignees=&labels=bug&projects=&template=bug_report.yaml) to our GitHub Repository. Even better, you can submit a Pull Request with a fix.

## Missing a feature?

So, you've got an awesome feature in mind? Throw it over to us by [creating an issue](https://github.com/CopilotKit/CopilotKit/issues/new?assignees=&labels=feature-request&projects=&template=feature_request.yaml) on our GitHub Repo.

If you don't feel ready to make a code contribution yet, no problem! You can also check out the [documentation issues](https://github.com/CopilotKit/CopilotKit/issues?q=is%3Aopen+is%3Aissue+label%3Adocumentation).

# How do I make a code contribution?

## Good first issues

Are you new to open source contribution? Wondering how contributions work in our project? Here's a quick rundown.

Find an issue that you're interested in addressing, or a feature that you'd like to add.
You can use [this view](https://github.com/CopilotKit/CopilotKit/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) which helps new contributors find easy gateways into our project.

## Step 1: Make a fork

Fork the CopilotKit repository to your GitHub organization. This means that you'll have a copy of the repository under _your-GitHub-username/repository-name_.

![Group 3](https://github.com/user-attachments/assets/7c2b8d15-87cf-4cc7-be86-5fadaebfad0b)

## Step 2: Clone the repository to your local machine

```
git clone https://github.com/<your-GitHub-username>/CopilotKit

```

![Group 4](https://github.com/user-attachments/assets/e3e78b2b-eead-463b-858b-8d40e4cb18e9)

## Step 3: Prepare the development environment

### 1)Install Prerequisites
- Node.js 20.x or later
- pnpm v9.x installed globally (npm i -g pnpm@^9)
- Turborepo v2.x installed globally (npm i -g turbo@2)

### 2)Install Dependencies
To install the dependencies using pnpm
Go inside project folder and run :

```jsx
pnpm install
```
### 3)Build Packages
To make sure everything works, let’s build all packages once:

```jsx
turbo run build
```

## Step 4: Create a branch

Create a new branch for your changes.
In order to keep branch names uniform and easy-to-understand, please use the following conventions for branch naming.
Generally speaking, it is a good idea to add a group/type prefix to a branch.
Here is a list of good examples:

- for docs change : docs/<ISSUE_NUMBER>-<CUSTOM_NAME>
- for new features : feat/<ISSUE_NUMBER>-<CUSTOM_NAME>
- for bug fixes : fix/<ISSUE_NUMBER>-<CUSTOM_NAME>

```jsx
git checkout -b <new-branch-name-here>
```

## Step 5: Make your changes

Now that everything is set up and works as expected, you can get start developing or update the code with your bug fix or new feature.

```jsx
# To start all packages in development mode
turbo run dev
 
# Start a specific package in development mode
turbo run dev --filter="@copilotkit/package-name"
```

## Step 6: Add the changes that are ready to be committed

Stage the changes that are ready to be committed:

```jsx
git add .
```

## Step 7: Commit the changes (Git)

Commit the changes with a short message. (See below for more details on how we structure our commit messages)

```jsx
git commit -m "<type>(<package>): <subject>"
```

## Step 8: Push the changes to the remote repository

Push the changes to the remote repository using:

```jsx
git push origin <branch-name-here>
```

## Step 9: Create Pull Request

In GitHub, do the following to submit a pull request to the upstream repository:

1.  Give the pull request a title and a short description of the changes made. Include also the issue or bug number associated with your change. Explain the changes that you made, any issues you think exist with the pull request you made, and any questions you have for the maintainer.

Remember, it's okay if your pull request is not perfect (no pull request ever is). The reviewer will be able to help you fix any problems and improve it!

2.  Wait for the pull request to be reviewed by a maintainer.

3.  Make changes to the pull request if the reviewing maintainer recommends them.

Celebrate your success after your pull request is merged :-)

## Git Commit Messages

We structure our commit messages like this:

```
<type>(<package>): <subject>
```

Example

```
fix(server): missing entity on init
```

### Types:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Changes to the documentation
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

## Code of conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

[Code of Conduct](https://github.com/CopilotKit/CopilotKit/blob/main/CODE_OF_CONDUCT.md)

Our Code of Conduct means that you are responsible for treating everyone on the project with respect and courtesy.

## Need Help?

- **Questions**: Use our [Discord support channel](https://discord.com/invite/6dffbvGU3D) for any questions you have.
- **Resources**: Visit [CopilotKit documentation](https://docs.copilotkit.ai/) for more helpful documentatation info.

⭐ Happy coding, and we look forward to your contributions!
