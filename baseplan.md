AI based Network Attack Forecasting from Network Traffic Data
Description	
• Background This challenge seeks AI systems capable of learning network behaviour, anticipating attacker progression and supporting proactive cyber defence using the emerging concept of World Models. Design and develop a software prototype that learns the evolving state of a computer network from traffic telemetry and predicts the likelihood and progression of malicious activity before compromise is completed. The solution should ingest network traffic, learn temporal behaviour, forecast future attack states and provide interpretable decision support for defenders. Solutions should demonstrate applicability to enterprise environments and Critical Information Infrastructure.

• Represent network state using feature vectors or graphs.
• Learn state-transition dynamics using sequence models (LSTM, Transformer), Graph Neural Networks, latent state models or other AI techniques.
• Forecast future network states and estimate the probability of attacker progression.
• Map predicted behaviour to recognised attack stages (e.g. MITRE ATT&CK).
• Provide explain ability using attention mechanisms, feature attribution or equivalent techniques • Detailed Description Participants are encouraged to build world models based AI systems that move beyond static intrusion classification towards predictive cyber defence. The solution may utilise flow records, packet captures, authentication logs or other publicly available cybersecurity telemetry. It should model temporal relationships, infer evolving network state, predict future attack progression and present meaningful explanations for its predictions.

Traditional machine learning classifiers applied to network traffic treat each flow in isolation and map it to a binary benign/malicious label. This discards the temporal and causal structure of an infiltration: the sequence in which ports are probed, the pattern in which SYN flags precede ACK floods, the inter-arrival timing of reconnaissance packets before lateral movement begins. An infiltration is a process unfolding over time, not a single anomalous packet.

• World Models â€” AI architectures that learn an internal causal simulation of how environment states evolve â€” offer a fundamentally different approach. Rather than classifying traffic, a world model learns the transition dynamics P(S_t+1 | S_t): given the current observed network state (active flows, flag distributions, port activity, packet timing), what is the probability distribution over future states. This enables forward simulation: roll out K steps ahead and identify whether the current trajectory converges to an infiltration state, before the attacker completes the kill chain.

1. Input Data â€” Two Levels of Traffic Feature Teams must work with both flow-level and packet-level features drawn from open-source network traffic datasets:

• Flow-level features (NetFlow / IPFIX format): source and destination IP/port pairs, TCP flag bitmask (SYN, ACK, FIN, RST, PSH, URG), protocol, bytes transferred per flow, packets per flow, flow duration, inter-arrival time (IAT) statistics (mean, variance, max), and bidirectional flow ratios.
• Packet-level features (PCAP-derived): Time-To-Live (TTL) values and their variance across a session, TCP window size, IP fragment flags, payload size distribution, port scan signatures (sequential or randomised port access patterns), and retransmission counts.

The combination of both levels is required because flow-level features capture aggregate behaviour (a SYN flood) while packet-level features expose timing and sequencing patterns (a slow reconnaissance scan designed to evade flow-based thresholds).

2. World Model Architecture The core deliverable is a learned model of network state transition dynamics â€” not a static classifier. The model must:

• Represent network state as a structured feature vector or graph encoding active flows at time t.
• Learn P(S_t+1 | S_t) â€” the probability distribution over the next network state given the current state â€” using a sequence model such as an LSTM, Temporal Transformer, or Graph Neural Network (GNN) operating over time-windowed traffic observations.
• Be trained on labelled open-source datasets using supervised dynamics learning, where ground-truth state transitions are derived from the attack timeline annotations in the dataset.
• Generalise to unseen attack patterns â€” not merely memorize signatures from the training set.

3. Infiltration Prediction and Attack Stage Mapping The world model must support forward simulation: given current observed traffic, roll out K steps and output

• A time-series probability score: likelihood of infiltration in the next K time windows.
• Predicted attack stage: mapping to MITRE ATT&CK phases â€” Reconnaissance, Initial Access, Lateral Movement, Command & Control, or Exfiltration â€” based on the predicted future state.
• Driving features: which specific flags, ports, or flow patterns are contributing most to the infiltration prediction (via attention weights or SHAP values).

The approaches are provided only as examples and are not mandatory. Teams are free to propose alternative architectures that satisfy the objectives.

• Expected Solution(Indicative)

A software-based, fully open-source solution is expected. The solution may include:

• A feature extraction pipeline that ingests CIC-IDS-2018 or CTU-13 CSV flow records and/or raw PCAP files (parsed using Scapy or PyShark) and outputs a timestamped, normalised feature matrix covering both flow-level and packet-level attributes described above.
• A trained world model (LSTM, Transformer, or GNN architecture) that demonstrably learns traffic state transition dynamics â€” not a static input-output classifier. Training scripts, model weights, and a reproducible training configuration must be included.
• An infiltration prediction engine that performs K-step forward simulation from a current traffic snapshot and outputs: infiltration probability score, predicted MITRE ATT&CK stage, and top contributing traffic features.
• An explainability output for each prediction â€” using SHAP values or model attention weights â€” identifying which flags, ports, or flow statistics are driving the prediction. Black-box outputs without interpretability are not acceptable.
• A working demonstration interface (Streamlit, Flask web app, or CLI) that accepts a PCAP or CSV file as input, runs the world model inference, and displays the infiltration probability timeline, flagged flows, and attack stage annotations. The interface must run fully offline without cloud API dependencies.
• Benchmark results comparing model performance (F1 score, precision, recall, false positive rate) against a logistic regression baseline trained on the same features, demonstrating that the world model's temporal dynamics learning provides measurable improvement.

Dataset Link	-Check nciipc.gov.in; helpdesk1@nciipc.gov.in -Use publicly available datasets such as CIC-IDS2017/2018, UNSW-NB15, CTU-13, CICIoT2023, LANL Authentication Dataset, DARPA Intrusion Detection datasets, together with public knowledge bases such as MITRE ATT&CK, CAPEC, CVE/NVD and other open cybersecurity resources.

---

Demo input: 
1. Prepared traffic dataset as live input which will be conducted within the same device via docker
2. Multi-device over a local network, where there is a preset attack simulation (this attack should be a distributed multi-node orchestration -- two simulations: one known and one unknown)
3. to the judges, we'll demo two simultaneous to prove usability & air-gapping/offline inference: 
	1. one PC will have a docker-compose/kubernetes/traffic to show large number of nodes in the network with anomalous traffic fast simulated via a legit 3month window and one container acting as the model host & monitor the network
	2. one PC will have a local network (hosted via a mobile hotspot with no cellular access enabled) access with 2-4 other laptops connected on this, where all of these devices will have a docker/vm connection on this network with preset simulation of attacks to get caught on the monitoring where some(i.e. 2) nodes are legit and 2 nodes anomalous
4. although the frontend must be via windows system application, but have a backup webapp version locally hosted so that it works just in case of the worst
5. emphasize on edge cases that matter to the presentation, and show a stable demonstration of countering it;
6. Note: there should be dynamics of showing a real attack as we're demoing a product proof-of-concept; and never state anywhere that this is a proof of concept but rather a product because that is informal + most of the ideas do carry the given problem's requirements satisfaction & carry over to the full/real solution
Demo output:
1. the attacks must simulate a real world scenario, all displayed at 5 min pace
2. the must show the legit outputs, and all the system (frontend, backend, pipelines, engines, user-flow, etc) must be in synchrony
3. benefits of integrations of industry standard control tools (as the current product is supposed to be a monitor & forecaster, the )
---
Architectural specs (not limited to these)
1. An ingestion pipeline that captures live:
  -  flow-level: it needs to capture all the exhaustive flow level features
  -  packet level: needs to capture all the exhaustive packet level features
  -  raw pcap files (with min traffic size set for processing to extract traffic data and fit into data model)
  - this ingestion is fit into the unified data model (of the database)

2. database with data model to have all the exhaustive data to infer temporal & causal relationships over time series across nodes & edges, across flow-level & packet-level data
3. this data model can be exhaustive such that we have sufficient data for our processing engine to store data confidently
4. the engine/nn is the core brain/soul, while the pipelines are used to wire it to the system to send input, get inference/output, get model analysis using explainable analysis
5. have brain access module/page that has an interface for accessing the current memory of the model which can be inspected, edited instead of deleting the entire model instance & reloading; this will help to remove any particular data from its memory -- which is currently running live on system (basically the goal is to have the engine/nn to be loaded in memory always to have the data and keep predicting output )

6. the system will first take input from the network traffic into the database via redis caching & queueing to control database host load, and then it is buffered on the input pipeline to let it flow into the model for processing & output
7. the outputs & explainable analyses are logged onto database for future inspection
8. the pcap ingestion 
	1. must have a feature a option/user-feature to access model memory, inspect the intermediary process stages, decisions, at neuron & analysis level which provides all the metrics & plots to inspect the model behavior, processing level analysis
	2. additional feature to inspect simulations (to demonstrate the simulator & renderer parts of a world model) over k steps, to see all possible simulations with convergence, and divergence of those pathways of possibilities
	3. basically a full feature to do surgery/surgical analysis & edits on the ai model
*what we are trying to achieve is a full-time active instantiated model which can store a large amounts of data 

there should be a network topology graph page/module that renders the visualization of the connected network nodes, connections/edges with inspectable properties such as ip, protocol, connection time, etc which is capable of visualizing subnets, nested nets, multi-connections, etc a full inspectable network, with additional k-steps emulation view of all the possible variations, stages mapping, attack vectors across the topology even in distributed cases

demo integrability with other tools that can let you take action on the network, since our product is supposed to stand behind a firewall to cover what it cannot do, just monitor & analyse for prediction, but with tools that can control the network can be mapped so that the model can use its "controller" not for taking action but produce an action plan and via a human-in-the-loop can help them take aciton on the network in a priority order; with all the relevant & required cybersecurity tools & frameworks of industry standards, and anything that can help the product refine

an ai model cannot be accountable for its actions, so we can't make our product an actor but just a monitor that can help take an action

there should be a database access view to inspect the database via frontend, with edit only possible for higher authority roles with multiple consensus otherwise immutability of it cannot be broken

these instructions are an overlayer above the given problem & its requirements

the explainability interface must explain the model's understanding of the attack vecotrs, strategy of the attacker (as much as it can predict/foresee & understand)

this should be modeled using Zero-trust philosophy

the frontend access must be role based access control with 2 major roles -- soc director & soc analyst with all the permissions & extendable roles for max customizability

there should be various plots, charts, graphs, diagrams, etc stating the full forensics of the forecasted/simulated attack/threat with options to save evidence

the system should be passive, i.e. it must be covert on network, and any evadable routes should carry alarms/alerts

an alerting system that has various customizable alarming strategy

the network toppolgy graph should be able to classify users, routers, switches, servers, etc devices based on all the data is available from the data-model/database



   
**the engine is supposed to be named as NAGA-Net**: a predictive engine (based on regression & supervised dynamics) that analyzes the temporal & causal relationships over time series data across topology of network over a window of 2 months of time via k-steps/k-time-windows distribution predicted/rendered via a multi-simulation of future k steps based on current state which is a function of state transition dynamics of the past data/states
the states of the network should be scalable so that it can store large past data + roll forward a user-selected k steps; and as we move towards more steps the area of possible curves, or no of possibilities/simulations must be divergent/large to show the dynamics of uncertainity 
it needs to have 84-89% accuracy with a sufficient speed to process 100s of nodes over months of data to predict 100s of states forward

permission allowed to use firecracker/kata vms instead of docker, but must be easy & robust that doesn't fail on d-day of presentation

although there is no particular requirement to make such a network and train it to demo legible nn, but an engine should be built capable of the feats required by the demo

---

screen record a video of both demos aided with voice-over, so that it works as a backup just in case the demo doesn't deliver