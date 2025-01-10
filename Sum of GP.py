# A naive solution for calculating sum of
# geometric series.

# function to calculate sum of 
# geometric series
def sumOfGP(a, r, n) :
	
	sum = 0
	i = 0
	while i < n :
		sum = sum + a
		a = a * r
		i = i + 1
	
	return sum
	
#driver function

a = 1 # first term
r = (float)(1/2.0) # common ratio
n = 10 # number of terms
		
print("%.5f" %sumOfGP(a, r, n)),
	
# This code is contributed by Nikita Tiwari
