
#include<iostream>


using namespace std;
int main() {
	int rows = 0 ;
	char alphabet = 65;
	cout << "input the rows :\n";
	cin >> rows;


	for (int i = 1; i <= rows; i++) {
		for (int j = 1; j <= i; j++) {
			cout << " " << alphabet;
			alphabet++;
		}
		cout << endl;
		alphabet = 65;
	}



	return 0;
}
