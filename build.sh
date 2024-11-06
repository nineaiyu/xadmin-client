#!/bin/bash

DOCKER_IMAGE_PREFIX="swr.cn-north-4.myhuaweicloud.com/nineaiyu"

images="xadmin-node:22.11.0-slim"
for image in ${images};do
  if ! docker images --format "{{.Repository}}:{{.Tag}}" |grep "^${image}" &>/dev/null;then
    full_image_path="${DOCKER_IMAGE_PREFIX}/${image}"
    docker pull  "${full_image_path}"
    docker tag "${full_image_path}" "${image}"
    docker rmi -f "${full_image_path}"
  fi
done


# build web
docker compose up xadmin-client-build
# clean old build docker
docker rm -f xadmin-client-build
