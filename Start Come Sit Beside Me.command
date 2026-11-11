#!/bin/zsh
cd -- "${0:A:h}" || exit 1
print 'Come Sit Beside Me preview: http://127.0.0.1:8081/'
print 'Keep this window open. Press Control+C to stop.'
python3 -m http.server 8081 --bind 127.0.0.1
print '\nServer stopped. If an error appeared above, check the message in this window.'
read -r '?Press Enter to close.'
