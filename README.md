# Todo App - Kubernetes DevOps Learning Project

## 📋 Project Overview

This is a **3-tier web application** built to practice and demonstrate real-world DevOps skills. The project focuses on containerization, Kubernetes orchestration, and deployment automation - exactly what you'd encounter in professional DevOps roles.

## 🎯 What I Actually Built & Learned

### 🐳 Containerization
- **Multi-stage Docker builds** for both frontend and backend
- **Optimized images**: React app built in build stage, served via nginx in production
- **Environment configuration** through Dockerfiles and runtime variables

### ☸️ Kubernetes Implementation
```
k8s/
├── backend-deployment.yaml    # Flask API with health checks
├── backend-service.yaml       # Internal service discovery
├── frontend-deployment.yaml   # React + nginx with proper probes
├── frontend-service.yaml      # ClusterIP for internal access
├── frontend-lb.yaml          # LoadBalancer for external access
└── ingress.yaml              # Routing rules (configured but needs tuning)
```

### 🔧 Real Infrastructure Challenges Solved
1. **Service Discovery**: Frontend containers automatically find backend via Kubernetes DNS
2. **Health Monitoring**: Readiness and liveness probes ensure application reliability
3. **Resource Management**: CPU and memory limits prevent resource exhaustion
4. **Networking**: Multiple service types (ClusterIP, LoadBalancer) for different access patterns

## 🚀 How to Deploy (What Actually Works)

### Prerequisites
- Minikube
- kubectl
- Docker

### Deployment Steps
```bash
# 1. Start your cluster
minikube start

# 2. Deploy the application
kubectl create namespace todo-dev
kubectl apply -f k8s/ -n todo-dev

# 3. Access the application
minikube service -n todo-dev todo-frontend-lb --url
# This gives you the working URL for your app
```

### Alternative Access Methods
```bash
# Port forwarding (most reliable)
kubectl port-forward -n todo-dev service/todo-frontend-service 8080:80
# Then access: http://localhost:8080

# Or use the provided scripts
./scripts/access-app.sh
./scripts/test-app-complete.sh
```

## 🛠️ Technical Stack

### Application Components
- **Frontend**: React.js served by nginx
- **Backend**: Flask REST API
- **Database**: SQLite (file-based, good for learning)

### DevOps Tooling
- **Container Runtime**: Docker
- **Orchestration**: Kubernetes
- **Service Mesh**: Basic networking without advanced mesh
- **Local Development**: Minikube

## 📈 Learning Outcomes

### ✅ Accomplished Skills
- **Containerization**: Built production-ready Docker images
- **Kubernetes Deployments**: Managed multi-container applications
- **Service Networking**: Configured internal and external access
- **Health Monitoring**: Implemented proper readiness/liveness checks
- **Troubleshooting**: Debugged real networking and deployment issues

### 🔄 Real Challenges Encountered
1. **WSL2 Networking**: Learned the complexities of Kubernetes networking in WSL
2. **Service Discovery**: Mastered how pods find each other via DNS
3. **Health Probes**: Understood the difference between readiness and liveness
4. **Resource Management**: Practiced setting appropriate CPU/memory limits

## 🗂️ Project Structure
```
todo-app/
├── backend/           # Flask application
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
├── frontend/          # React application
│   ├── Dockerfile     # Multi-stage build
│   ├── nginx.conf     # Production nginx config
│   └── (React source)
├── k8s/               # Kubernetes manifests
├── scripts/           # Deployment and testing scripts
└── docker-compose.yml # Local development
```

## 🎓 DevOps Skills Demonstrated

This project proves hands-on experience with:

1. **Infrastructure as Code**: All infrastructure defined in YAML
2. **Container Orchestration**: Multi-service deployment and management
3. **Service Mesh Basics**: Internal networking and service discovery
4. **Monitoring**: Application health checking and recovery
5. **Troubleshooting**: Real-world problem solving in Kubernetes

## 🚧 Known Limitations & Learning Opportunities

- **Ingress**: Configured but requires additional setup for full functionality
- **Database**: Uses SQLite - ready to upgrade to PostgreSQL for production learning
- **CI/CD**: Manual deployment - ready for GitHub Actions pipeline implementation
- **Monitoring**: Basic health checks - ready for Prometheus/Grafana integration

## 🔜 Next Learning Steps

This project is perfectly positioned for:
1. **CI/CD Pipeline**: Add GitHub Actions for automated testing and deployment
2. **Database Upgrade**: Replace SQLite with PostgreSQL + persistent volumes
3. **Monitoring Stack**: Add Prometheus metrics and Grafana dashboards
4. **Service Mesh**: Implement Istio for advanced traffic management

## 💡 Why This Matters for DevOps Roles

This isn't just another "todo app" - it's a **demonstration of production-ready DevOps skills**:
- Real containerization strategies
- Actual Kubernetes deployment experience
- Hands-on troubleshooting of real infrastructure issues
- Understanding of service mesh and networking concepts

The challenges solved here (networking, health checks, resource management) are exactly what DevOps engineers face daily.

---

**Built to learn, documented to demonstrate real DevOps competency.** 🚀
