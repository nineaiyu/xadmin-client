#!/bin/bash
#
#
# clean old build docker and image
docker rm -rf xadmin-client-build
docker image rm xadmin-client-build

# build web
docker compose up xadmin-client-build
