# Issueage

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

Generate Website/Github Pages with Github Issues.

# How to use

## Add Issueage to existing repository

Add Issueage to your repository.

```bash
git remote add issueage https://github.com/zeikar/issueage
git fetch issueage
git checkout -f -b issueage issueage/master
vi config.json
```

Configure your config.json and commit it.

```bash
git add config.json
git commit -m "Apply Issueage"
git push origin issueage
```

Github Actions only works on the default branch (master/main). So you need to move Github Actions script to the default branch.

```bash
git switch <default-branch> --force
git restore --source issueage -- .github/workflows/gh-pages.yml
git add .github/workflows/gh-pages.yml
git commit -m "Add issueage Github Actions script"
git push origin <default-branch>
```

And set Source to gh-pages in Github Pages settings. (https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Then you can access your Github Pages!

# Build and run locally

## Run in development mode

Install the dependencies

```bash
npm install
npm run dev
```

Navigate to [localhost:5000](http://localhost:5000). You should see your app running. Edit a component file in `src`, save it, and reload the page to see your changes.

By default, the server will only respond to requests from localhost. To allow connections from other computers, edit the `sirv` commands in package.json to include the option `--host 0.0.0.0`.

If you're using [Visual Studio Code](https://code.visualstudio.com/) we recommend installing the official extension [Svelte for VS Code](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode). If you are using other editors you may need to install a plugin in order to get syntax highlighting and intellisense.

## Building and running in production mode

To create an optimised version of the app:

```bash
npm run build
```

You can run the newly built app with `npm run start`. This uses [sirv](https://github.com/lukeed/sirv), which is included in your package.json's `dependencies` so that the app will work when you deploy to platforms like [Heroku](https://heroku.com).

# License

Distributed under the MIT License. See `LICENSE` for more information.

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[contributors-shield]: https://img.shields.io/github/contributors/zeikar/issueage.svg?style=for-the-badge
[contributors-url]: https://github.com/zeikar/issueage/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/zeikar/issueage.svg?style=for-the-badge
[forks-url]: https://github.com/zeikar/issueage/network/members
[stars-shield]: https://img.shields.io/github/stars/zeikar/issueage.svg?style=for-the-badge
[stars-url]: https://github.com/zeikar/issueage/stargazers
[issues-shield]: https://img.shields.io/github/issues/zeikar/issueage.svg?style=for-the-badge
[issues-url]: https://github.com/zeikar/issueage/issues
[license-shield]: https://img.shields.io/github/license/zeikar/issueage.svg?style=for-the-badge
[license-url]: https://github.com/zeikar/issueage/blob/master/LICENSE.txt