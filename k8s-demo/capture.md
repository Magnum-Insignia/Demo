Capture runs on the kind node containers, not in a pod: tcpdump on the CNI
bridge sees every pod-to-pod packet with real source/dest pod IPs. The pcap is
copied out to the host and fed to pipeline.run pcap.
