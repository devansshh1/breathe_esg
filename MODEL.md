For  data modelling  we  have taken csv files for sap and utility pipeline and json response for payload intake.

Conditions-As in the headers of csv files we can have different languages I have taken a set of standard column names as standard and if the column names do not match then the user
has to input the corresponding column name which helps us to ensure that our data quality is always maintained (visible in the below ss)

<img width="825" height="756" alt="image" src="https://github.com/user-attachments/assets/bc72841f-4eea-4b38-8e5d-3d9a41c770f2" />


1) Multi-Tenancy

Every single data row in the database is locked to a specific company account using a company identifier column (like here tenant ID as visible in the below screenshot).

<img width="496" height="215" alt="image" src="https://github.com/user-attachments/assets/2edb000f-e327-415f-bb20-693ac9948920" />
(defined as demo tenant here ,for other organization it will be different)



2) Scope 1/2/3 Categorization

Our schema maps emissions records directly to the  standards using a strict category designation. It separates activities into Scope 1 (direct combustion from owned asset), 
Scope 2 (indirect  consumption like purchased electricity), and Scope 3 ( activities like travel and shipping) for accurate compliance reporting.

<img width="911" height="317" alt="image" src="https://github.com/user-attachments/assets/efe229b7-a3cc-4ebd-ad4a-1c3a2f0fbf96" />

as visible in the above ss in the 2nd column we have defined different scopes for each (in above we can see Scope 1 for a row and Scope 3 for other row )


3) Source Of Truth

Every row in our database saves metadata that answers three questions: Who made it?, How did it get here? (Did a user type it in, did an API sync it, or did a file upload it?), 
and When was it created?. The auditors can not edit the data so truth is always immutable.

<img width="1477" height="578" alt="image" src="https://github.com/user-attachments/assets/1c3d354d-b907-40e9-9954-d738f3a20c42" />

as we can see in the above ss we know who sent the data ,what is the source and when was it created and everything is immmutable thus truth is maintained


4) Unit Normalization 

In the real world, carbon data(as we as all the data) arrives in messy, mixed units(no uniformity): electricity bills are in kilowatt-hours (kWh), fuel is in gallons, and shipping is in miles. 
We cannot add these together directly. To fix this, we store two things: the original raw input, and a separate, normalized column. 
The backend automatically multiplies the raw input by an official carbon conversion factor and saves the final result in Metric Tons . This ensures all the charts and 
totals speak the exact same mathematical language.

<img width="1453" height="164" alt="image" src="https://github.com/user-attachments/assets/3bcf9e10-fe11-49f1-bdc3-af6b553406e5" />

miles was normalized to km (it is a standard we can also have reverse but we follow a set of standards always)
We also have a column which tells us if the data was normalised or was not normalised and this column also tells what was the output after normalization (as visible in above ss) 


5) Audit Trail

It is not possible to make any changes to the data once the data reaches the analysts ,this is very important to ensure that no intentional/un-intentional changes can take place in the data  
Also to ensure better understanding of the data ,an interactive graph is also added for all the data which is approved or locked.

<img width="1508" height="546" alt="image" src="https://github.com/user-attachments/assets/8abca66b-3e79-4633-80db-0c56a90987fe" />
