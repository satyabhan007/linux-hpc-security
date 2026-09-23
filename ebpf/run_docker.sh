#!/bin/bash
sudo docker run -it --rm --privileged -v /sys/kernel/debug:/sys/kernel/debug:rw -v /lib/modules:/lib/modules:ro -v /usr/src:/usr/src:ro -v $(pwd):/lab ebpf-lab
