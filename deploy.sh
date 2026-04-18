#!/bin/zsh

rsync -a . droplet:~/static/ebirdsound

echo "✨ Deployment complete!"
