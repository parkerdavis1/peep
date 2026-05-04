#!/bin/zsh

ssh-add -t 120s

pnpm build

echo "copying files to droplet..."

rsync -a dist/ droplet:~/static/peep

echo "✨ Deployment complete!"
