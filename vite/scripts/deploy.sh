#!/bin/zsh

ssh-add -t 120s

pnpm build

echo "copying files to droplet..."

rsync -a dist/ droplet:~/static/ebirdsound

echo "✨ Deployment complete!"
