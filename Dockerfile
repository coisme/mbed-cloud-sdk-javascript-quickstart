FROM node:alpine

MAINTAINER Michael Bartling "michael.bartling@arm.com"

# Install software 
RUN apk add --update \
    git \
    gcc \
    build-base \
    python \
    py-pip \
    python-dev \
    libffi-dev \
    openssl-dev \
    openssh-client 

# Make ssh dir
RUN mkdir /root/.ssh/
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . /usr/src/app

# Copy over private key, and set permissions
ADD id_rsa /root/.ssh/id_rsa

# Create known_hosts
RUN touch /root/.ssh/known_hosts
# Add rsa key
RUN ssh-keyscan github.com >> /root/.ssh/known_hosts

# Configure Git 
RUN git config --global url.ssh://git@github.com/.insteadOf https://github.com/

RUN npm install

EXPOSE 8080

# Run the linux client
ENTRYPOINT ["node", "app.js"]
