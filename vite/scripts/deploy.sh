#!/bin/zsh

ssh-add -t 120s

pnpm build

rsync -a dist/ droplet:~/static/ebirdsound

echo "✨ Deployment complete!"
