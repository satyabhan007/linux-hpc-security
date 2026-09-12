/* linux-hpc-security Learn — Part 3 · Chapter 2: Warewulf & Stateless Provisioning at Scale */
window.CH[2] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A new 200-node rack arrives. Nobody wants to install an OS by hand 200 times, and nobody wants 200 machines that slowly drift apart
      as admins patch some but not others. <b>Warewulf</b> solves this by making compute nodes <b>stateless</b>: they have no local disk state
      that matters. Every boot, a node PXE-boots, pulls a kernel and a read-only root filesystem image over the network, and comes up identical
      to every other node of its class — every single time.</p>
      <pre><code>Node powers on → PXE/iPXE → DHCP gives it an IP → TFTP/HTTP serves kernel+initramfs
        → initramfs pulls the container-built VNFS image → node boots into RAM-resident rootfs</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A hotel room, not an owned apartment.</b> An apartment (a traditionally
      installed node) accumulates the tenant's stuff over years — nobody remembers what's really in it anymore. A hotel room (a stateless node)
      is reset to an identical, known state for every new guest (every boot). If a hotel room breaks, you don't renovate it — you just put the
      guest in an identical room down the hall. That's what re-imaging a failed compute node feels like with Warewulf.</p></div>`,
      try: [
        ['📖 Warewulf — Getting Started', 'https://warewulf.org/docs/latest/contents/quickstart.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Warewulf 4 builds node images from a <b>container</b> (an OCI image or chroot), turns it into a <b>VNFS</b> (Virtual Node File
      System), and serves it to nodes on boot alongside an <b>overlay</b> — small, per-node or per-class files (hostname, network config,
      SSH host keys) injected on top of the shared image without rebuilding it:</p>
      <pre><code># build/import a node image from a container
$ wwctl container import docker://rockylinux:9 rocky-9
$ wwctl container build rocky-9

# define a node, assign it a profile and the image
$ wwctl node add n0001 --netdev=eth0 --ipaddr=10.0.0.101 \\
    --hwaddr=aa:bb:cc:dd:ee:01 --profile=compute --container=rocky-9

# system overlay carries per-node identity (hostname, /etc/hosts, keys)
$ wwctl overlay build n0001
$ wwctl overlay show system host | grep -i n0001

# regenerate PXE/DHCP config for all defined nodes and reboot them
$ wwctl configure --all
$ wwctl power cycle n0001</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tool is <b><code>wwctl</code></b> (Warewulf 4's CLI), backed by
      <b>ipxe</b> for network boot and an <b>overlay</b> system with two layers: the <i>system overlay</i> (host identity, network, SSH) applied
      to every node, and a <i>runtime overlay</i> re-rendered on a schedule via <code>wwclient</code> so config drift (e.g. Slurm's
      <code>slurm.conf</code> changing) propagates to running nodes without a reboot.</p></div>`,
      try: [
        ['📖 Warewulf — Node Profiles', 'https://warewulf.org/docs/latest/contents/nodes.html', 'o'],
        ['📖 Warewulf — Overlays', 'https://warewulf.org/docs/latest/contents/overlays.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A kernel/driver mismatch after a firmware update.</b> Ops flashes new
      BIOS/BMC firmware across a GPU rack, then a routine reboot leaves half the nodes failing to load the NVIDIA driver — the running
      <code>uname -r</code> kernel in the VNFS predates a firmware-required fix. Because nodes are stateless, there's no "some nodes got the
      new driver, some didn't" drift to untangle: the fix is entirely in the image. Rebuild the container with the updated kernel/driver,
      <code>wwctl container build</code>, then <code>wwctl power cycle</code> the rack — every node comes back identical and correct, instead
      of a multi-day per-node SSH-and-patch exercise.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Building an overlay for a new node class.</b> A new "bignode" class
      needs a different <code>/etc/security/limits.conf</code> (higher memlock for RDMA) and a class-specific Slurm <code>gres.conf</code>
      line for 8 GPUs, but must share the base image with every other compute node. Rather than forking a whole new container, put the
      differences in an overlay template attached to the <code>bignode</code> profile: <code>wwctl overlay edit bignode limits.conf.ww</code>
      using Warewulf's Go-template syntax (<code>{{ .Tags.gpu_count }}</code>-style substitution), then
      <code>wwctl profile set bignode --container=rocky-9</code> and reassign nodes to the profile — one shared image, many overlay-driven
      personalities.</p></div>
      <p><b>Stateless doesn't mean "no local disk at all":</b> nodes commonly still have local NVMe for scratch space or a swap file — what's
      stateless is the <i>root filesystem</i> and its configuration, which is always rebuilt from the source of truth (the container + overlay
      templates), never hand-edited on the node itself.</p>`,
      try: [
        ['📖 Warewulf — Overlay Templates', 'https://warewulf.org/docs/latest/contents/overlays.html#templates', 'o'],
        ['🖥️ Ch 9 — node health checks & automated remediation', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
SSHing into a node to "just fix one         Never hand-edit a running node. Edit the container or the
thing" and forgetting about it              overlay template, rebuild, reboot the node — the fix must
                                             survive the next reboot or it doesn't exist.
One giant container for every node          Split by node class (login/compute/gpu/bignode) so a driver
class (CPU, GPU, login nodes alike)         change for GPU nodes doesn't force rebuilding/rebooting the
                                             entire fleet, including nodes it doesn't affect.
Overlay templates with hardcoded            Use node/profile Tags ({{ .Tags.rack }}, {{ .Id.Ipaddr }}) so one
per-node values baked in                    template renders correctly for every node in the class.
Rebooting the whole rack to pick up         Runtime overlay changes (e.g. slurm.conf) propagate via
a config change                             wwclient on its refresh interval — no reboot needed for
                                             files served through the runtime overlay.
No image version pinning — "latest"         Tag container builds (rocky-9-2026-08) so a bad build is a
overwritten in place on every rebuild       one-line rollback (wwctl node set --container=X) instead of
                                             an unrecoverable in-place overwrite.
Treating PXE/DHCP failures as a             A node stuck at PXE usually means DHCP reservation, TFTP/
mystery instead of checking the chain       HTTP boot service, or wwctl's own dhcpd/tftpd config drifted
                                             — walk the boot chain top to bottom before assuming hardware.</code></pre>
      <p><b>The real test:</b> if a node fails, is your instinct to SSH in and start fixing files, or to check which container/overlay it's
      assigned, diff that against a known-good node, and re-image? The second instinct is what "stateless at scale" actually buys you.</p>`,
      try: [
        ['📖 Warewulf — wwctl(1) reference', 'https://warewulf.org/docs/latest/contents/wwctl.html', 'o'],
        ['🖥️ Ch 6 — GPU scheduling: MIG, time-slicing & GRES', '#ch6', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert scale, stateless provisioning is a <b>configuration-management philosophy</b>, not just a boot mechanism: it forces the
      entire node definition — kernel, drivers, packages, and per-class config — to live in version-controlled artifacts (containers +
      overlay templates) rather than in the accumulated, unaudited state of running machines. This is what makes a 5,000-node cluster
      operationally tractable: "what does node 4821 look like" is answered by reading its profile and container tag, not by SSHing in and
      hoping nothing was hand-patched.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why does Warewulf rebuild the node's entire root filesystem from a container image instead of
   configuration-managing a persistent install (Ansible/Puppet on top of a normal OS install)?
A: Configuration management converges toward a desired state but can't guarantee it reaches it — drift
   accumulates from anything outside its scope (manual fixes, partial runs, order-dependent bugs). A
   stateless image guarantees every boot starts from the exact same bytes; there is no "converge," only
   "replace."

Q: A firmware update breaks the GPU driver on half a rack. What's the Warewulf-native fix?
A: Rebuild the container with the compatible kernel/driver version, then power-cycle the affected nodes.
   Because the nodes are stateless, there's no partial-patch state to reconcile — every node that boots
   the new image is correct, and any that haven't rebooted yet are simply still on the old (also
   internally consistent) image.

Q: When would you use the runtime overlay instead of just rebuilding the container?
A: For values that must reflect current cluster state without a full reboot cycle — e.g. slurm.conf,
   /etc/hosts, or SSH host keys. The runtime overlay re-renders on a schedule via wwclient, so it fits
   config that changes more often than the base OS image should.

Q: Why split node images by class (compute/gpu/login/bignode) instead of one universal image?
A: A single universal image forces every class through the same rebuild/reboot blast radius for changes
   that only matter to one class (e.g. a GPU driver bump). Splitting by class scopes the blast radius of
   any given image change to the nodes it actually affects.

Q: What's the failure mode of NOT pinning container build versions?
A: A rebuild overwrites the "latest" image in place. If that build is bad, every node imaging against it
   picks up the bug simultaneously with no easy rollback — pinned, tagged builds turn that into a
   one-line "wwctl node set --container=last-good-tag" recovery.</code></pre>`,
      try: [
        ['📖 Warewulf — Architecture Overview', 'https://warewulf.org/docs/latest/contents/arch.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does Warewulf rebuild a node’s entire root filesystem from a container image on every boot instead of configuration-managing a persistent install?',
      opts: [
        'Because container images boot faster than any local disk',
        'Configuration management only converges toward a state and can drift; a stateless image guarantees every boot starts from identical bytes',
        'Because Warewulf cannot install packages after boot',
        'It is purely a licensing requirement'],
      ok: 1,
      why: 'Stateless imaging replaces the "converge toward desired state" model with "replace with known-good bytes every boot," eliminating accumulated drift entirely.' },
    { q: 'A firmware update breaks the GPU driver on half a rack of stateless nodes. What is the Warewulf-native fix?',
      opts: [
        'SSH into each broken node and manually update the driver',
        'Rebuild the container image with the compatible kernel/driver, then power-cycle the affected nodes',
        'Reinstall the OS from physical media on each node',
        'Disable the GPU nodes permanently'],
      ok: 1,
      why: 'The fix belongs in the image (container), not on individual running nodes — rebuild once, then reboot to apply it fleet-wide with no per-node drift.' },
    { q: 'What is the difference between Warewulf’s system overlay and runtime overlay?',
      opts: [
        'There is no difference, they are aliases',
        'The system overlay applies host identity/network config at boot; the runtime overlay re-renders periodically via wwclient for config that changes without a reboot',
        'The runtime overlay only works on GPU nodes',
        'The system overlay is optional and rarely used'],
      ok: 1,
      why: 'System overlay = boot-time identity; runtime overlay = live-refreshed config (e.g. slurm.conf) so changes propagate without rebooting every node.' }
  ]
};
