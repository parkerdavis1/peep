#!/bin/zsh

ssh-add -t 120s

pnpm build

echo "\ncopying files to droplet..."

rsync -av dist/ droplet:~/static/peep

echo "\n✨ Deployment complete!\n"
