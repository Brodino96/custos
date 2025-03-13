# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:slim AS base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun bundle

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=build /usr/src/app/dist/* /usr/src/app/
COPY config.toml /usr/src/app/config.toml


# run the app
USER bun
EXPOSE 8080/tcp
ENTRYPOINT [ "bun", "run", "main.js" ]