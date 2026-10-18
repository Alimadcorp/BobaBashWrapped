
#include <iostream>
using namespace std;
int main() {
   int rows,n;
    int j= 1;
    int i=1;
    int l= 1;
    
    cout<<"input the rows :\n";
        cin>> rows;
    for( ; i<=rows; i++){
        for( ; j<(rows-i) ; j++){
            cout<< " ";}
            for(int k= 1 ; k<rows ; k++){
                cout<< "*";
            }
             for( ; l<(rows-i) ; l++){
            cout<< " ";
        }
        cout<< endl;

    }
    return 0;
}