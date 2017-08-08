#!/bin/bash
# Stolen from selenium docker (which doesnt work there for some reason)
source /opt/bin/functions.sh

export GEOMETRY="$SCREEN_WIDTH""x""$SCREEN_HEIGHT""x""$SCREEN_DEPTH"

function shutdown {
  kill -s SIGTERM $NODE_PID
  wait $NODE_PID
}

SERVERNUM=$(get_server_num)


# Super Hack
xvfb-run -n 99 --server-args="-screen 0 $GEOMETRY -ac +extension RANDR" java -jar /opt/selenium/selenium-server-standalone.jar &
NODE_PID=$!

trap shutdown SIGTERM SIGINT
wait $NODE_PID
