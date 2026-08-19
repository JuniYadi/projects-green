# Context Glossary: App Hosting & Compute Billing

## Overview
App Hosting provides containerized application deployments charged using a prepaid Pay-As-You-Go (PAYG) wallet model based on provisioned compute capacity.

## Core Terms

### ApplicationStack
A logical application deployment unit consisting of compute resources (CPU, Memory), replica count, configuration (environment variables, build settings), and network bindings (domains/routes).

### Provisioned Compute (Reservation)
The allocated compute capacity requested for an ApplicationStack (measured in milli-cores of CPU and megabytes/MiB of RAM across all running replicas) that is guaranteed and reserved on the hosting cluster during active run states. Charges are strictly tied to reservation rather than measured utilization.

### Milli-core (mCPU)
The atomic unit of CPU allocation where 1000m represents 1 full vCPU core ($1.0\text{ vCPU} = 1000\text{ mCPU}$). PAYG sizing is configurable in increments of 100m.

### Replica Multiplier
When a stack runs multiple instances ($N$ replicas), total billable compute scales linearly:
$$\text{Total mCPU} = N \times \text{mCPU}_{\text{per-instance}}$$
$$\text{Total MiB} = N \times \text{MiB}_{\text{per-instance}}$$

### Hourly Rate / Hourly Cost
The deterministic hourly price computed from the configured CPU and Memory across all replicas:
$$\text{HourlyCost} = N \times [(\text{mCPU} \times \text{Rate}_{\text{CPU}}) + (\text{MiB} \times \text{Rate}_{\text{RAM}})]$$
Rates are governed via deterministic constants in code (`PAYG_CPU_RATE_PER_MILLI_HOUR = 0.00005`, `PAYG_MEMORY_RATE_PER_MIB_HOUR = 0.00001`) and snapshotted onto `ApplicationStack.hourlyCost` at creation or resize time.

### Pro-Rata Duration Billing
When a stack changes state, scales compute resources, or changes replica count mid-hour, charges for that hour are calculated exactly by duration-weighted intervals:
$$\text{Charge}_{\text{hour}} = \sum_{i} (\text{HourlyCost}_i \times \frac{\Delta t_i}{3600\text{s}})$$

### Runtime Buffer Gate
The safety requirement that an organization's prepaid `BillingAccount` balance must cover at least 24 hours of the stack's total hourly cost before any deployment, restart, or scale operation is allowed to execute:
$$\text{RequiredBalance} = \text{HourlyCost} \times \max(24, \text{BufferHours})$$

### Prepaid Balance Wallet
The primary billing account holding pre-funded balance in currency (USD/IDR), decremented periodically (hourly cron) as stacks consume provisioned compute time.

### Active Compute State
The lifecycle states (`RUNNING`, `HEALTHY`) during which compute capacity is provisioned on cluster nodes and the hourly CPU/RAM meter ticks. When a stack is `STOPPED`, `SUSPENDED`, or `TERMINATED`, compute charges stop immediately.

### Payment Grace Period (`PAYMENT_GRACE`)
When the prepaid balance becomes insufficient during active runtime, the stack enters a 24-hour grace window. The stack remains running, and alerts are dispatched. If un-replenished after 24 hours, the stack is scaled to 0 replicas and transitioned to `SUSPENDED`.
