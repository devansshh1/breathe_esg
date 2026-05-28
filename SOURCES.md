###   Source 1: SAP ERP Data (Supply Chain/Materials)

1. Real-World Format Researched
   
In major corporations, supply chain data is  exported from SAP systems. These are typically massive, comma-separated
 or tab-separated flat files (.csv or .txt) . CSV files are also used extensively in inventory and logistics. CSV files
 also have massive use in legacy systems so I have used CSV file.

2. What I Learned

SAP exports are structurally rigid. They often use highly technical, abbreviated, or language-specific column headers . 
They also mix data types in a single column—for instance, putting numbers and text descriptions together, which 
makes parsing impossible without a cleaning step.

3. How does the sample data look

    Material,    Quantity,   Unit ,        Date
    Steel_Beam_A,  50,        Metric_Tons,  2026-05-15
    Concrete_V2,   120,      Cubic_Meters,  2026-05-16


WHY?   

We need to standarize the data so we choose what format we have to convert to and accordingly conversion factor is also decided.


4.  What Would Break in a Real Deployment

   If the number of columns are more than 4 then would break in real world as we are mapping data with 4 default coolumn names
   i.e [Quantity, Unit , Material , Date]



   

###  Source 2: Utility Pipeline Data 


1. Real-World Format Researched

This is data tracking energy consumption — like electricity bills . Real-world utilities usually share this data 
via CSV sheets exported from  provider portals.


2. What We Learned
   
Utility data is heavily chronological (date-wise arranged). A single facility might have ten different meters, each generating
hundreds of rows of continuous usage data. The biggest challenge is time formatting and  grid variations , a kilowatt-hour of electricity 
consumed in a coal-reliant region has a much higher carbon impact than one consumed in a hydro-powered region.


3. Sample Data Looks Like & Why

    Source   ,       Quantity,        Unit ,        Date
    Electricity_Grid,    4500,         kWh,           2026-05-01
     Natural_Gas,       350,        Therms,          2026-05-01

Why:   This captures power variables cleanly. It tracks energy types (kWh vs. Therms) separately because they require completely different
       EPA carbon conversion equations to determine their final impact.
       

4.  What Would Break in a Real Deployment

   1)  Estimated vs. Actual Bills:  Companies frequently put "estimated" readings on invoices and then correct them  three months
       later. A real deployment would break or create duplicate entries because the system wouldn't naturally know how to overwrite an old, estimated
       database row with the new, verified data.

  2) If the number of columns are more than 4 then would break in real world as we are mapping data with 4 default coolumn names
     i.e [Quantity, Unit , Material , Date]




     

###  Source 3: JSON Payload Intake

1. Real-World Format Researched
   
 This represents live  data streaming directly into our application via an API. It uses standard JSON format payloads sent via HTTP POST requests from modern web forms,
 mobile apps and similar devices.

2. What We Learned

   While JSON is incredibly clean to work with, it is highly sensitive to syntax. Unlike a CSV file where a missing column just yields a blank space, a missing bracket,
   where a number is expected can reject the entire payload before the database can even process it.

3. Sample Data Looks Like & Why

     {
             "material": "Jet_Fuel_A1",
             "quantity": 1500,
             "unit": "Gallons",
             "date": "2026-05-28"
   }

 Why:    It follows a strict key-value format for API handling. The backend can instantly grab these keys, run them through validation checks and pass them straight
         to our Django(backend) models.


4.   What Would Break in a Real Deployment

   Malformed Client JSON: If an external client script sends an empty string for distance/quantity instead of an explicit null or 0 , the JSON parser will throw a 
   validation error or crash the server workflow.




