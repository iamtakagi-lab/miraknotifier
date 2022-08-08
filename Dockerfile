FROM node:16

RUN apt-get update \
    && apt-get install -y locales \
    && locale-gen ja_JP.UTF-8 \
    && echo "export LANG=ja_JP.UTF-8" >> ~/.bashrc

WORKDIR /app
COPY ./package.json /app/
RUN yarn
COPY . /app/
RUN yarn build

CMD [ "node", "index.js" ]