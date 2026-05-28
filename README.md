# Breathe ESG — Carbon Accounting Platform

Breathe ESG is an application built to ingest, normalize, and track corporate greenhouse gas emissions data across enterprise  chains.

---

##  Key Features & Architecture Description

Our backend and data layer support the following :

** Multi-Tenancy:**           No organisation can see the data of another company
** Source of Truth Tracking:  Ensures that we can see clearly what was the data source and by whom data was created.
** Unit Normalization Engine:  Ensures that data is normalised
** Audit Trail :**             Ensures that data is immutable  

---

##  Tech Stack

 **  Frontend:         React, TypeScript, React Router, Tailwind CSS
 **  Backend:          Django (Python), Django REST Framework
 **  Database:         PostgreSQL
 **  Deployment:       Vercel (Frontend) & Render (Backend / Database)

---

##  Deep-Dive Documentation

To review our complete design choices, omissions, and source files as required by the evaluation criteria, please look at the specific markdown links below:

1. ** (./MODEL.md) —                   Breakdown of our database schema, multi-tenancy rules.
2. ** (./DECISIONS.md)—               Architectural trade-offs made during development, resolved ambiguities, and technical questions submitted to the Product Manager.
3 ** (./SOURCES.md)** —               Detailed analysis of our data integration pipelines (SAP ERP exports, Utility Logs, and JSON live API payloads).

---

##  Quick Local Setup

1. Backend Setup

cd backend
python manage.py runserver
(check requirments.txt)

2.  Frontend Setup

   cd frontend
   npm install
   npm run dev
