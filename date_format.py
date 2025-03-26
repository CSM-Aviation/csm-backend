import pandas as pd

# File paths
input_file = 'Month_to_Date.csv'
output_file = 'Modified_Calls_Report_Simple.csv'

# Skip the metadata rows and read the actual data
df = pd.read_csv(input_file, skiprows=5)

# Convert 'End Date and Time' column to just date
if 'End Date and Time' in df.columns:
    df['End Date and Time'] = pd.to_datetime(df['End Date and Time']).dt.date
    df['Start Date and Time'] = pd.to_datetime(df['Start Date and Time']).dt.date
else:
    print("Column 'End Date and Time' or 'Start Date and Time' not found")

# Save the modified data
df.to_csv(output_file, index=False)
print(f"Conversion complete. Modified file saved as: {output_file}")