FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    bpfcc-tools \
    python3-bpfcc \
    linux-headers-generic \
    netcat \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /lab
COPY detector.py .
CMD ["/bin/bash"]
