#!/bin/bash

DOCKER_IMAGE_PREFIX="swr.cn-north-4.myhuaweicloud.com/nineaiyu"

images="node:22.10.0-alpine xadmin-node:22.10.0-alpine"
for image in ${images};do
  full_image_path="${DOCKER_IMAGE_PREFIX}/${image}"
  docker pull  "${full_image_path}"
  docker tag "${full_image_path}" "${image}"
  docker rmi -f "${full_image_path}"
done

# clean old build docker and image
docker rm -f xadmin-client-build
docker image rm xadmin-client-build

# build web
docker compose up xadmin-client-build
