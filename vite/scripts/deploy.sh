#!/bin/zsh

pnpm build

rsync -a dist/ droplet:~/static/ebirdsound

echo "✨ Deployment complete!"
