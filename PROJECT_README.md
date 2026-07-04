# Project Setup & Workflow

## Canonical project location

This project lives at:

```
~/Projects/ashkanfaraa-site
```

This is the only location that should be used for development. Do not create
or work from other copies of this repository.

## Never develop from Desktop or an iCloud-synced folder

Do not clone or develop this project inside `~/Desktop` or any other folder
synced by iCloud Drive. iCloud can leave files as "dataless" placeholders
(present in directory listings but not actually downloaded), which silently
breaks the working tree and the local `.git` directory — including missing
`.git/config`, invalid refs, and unrecoverable local history. Always work from
`~/Projects/ashkanfaraa-site` instead.

## GitHub is the source of truth

The canonical history for this project is the `main` branch at:

```
https://github.com/ashkanfara/ashkanfaraa.com
```

If the local working copy is ever lost, corrupted, or unclear, re-clone from
GitHub rather than trying to reconstruct it locally.

## Push to main after every completed feature

Once a feature or fix is implemented and verified, push it to `main`. Don't
let completed work sit unpushed locally — GitHub should always reflect the
latest working state.

## Small, atomic commits with descriptive messages

Prefer several small, focused commits over one large commit. Each commit
should represent one logical change and have a clear, descriptive message
explaining what changed.
